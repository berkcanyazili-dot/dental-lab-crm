import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export interface SessionTenantAccess {
  tenantId: string;
  tenantName: string;
  dentalAccountId: string | null;
  dentalAccountName: string | null;
  isDefault: boolean;
}

async function sendMagicLinkEmail({
  identifier,
  url,
}: {
  identifier: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Magic link email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [identifier],
      subject: "Your Dental Lab CRM sign-in link",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
          <h2 style="margin: 0 0 16px;">Sign in to Dental Lab CRM</h2>
          <p style="margin: 0 0 16px;">
            Click the secure link below to sign in. This link expires automatically.
          </p>
          <p style="margin: 0 0 24px;">
            <a href="${url}" style="display:inline-block;background:#0284c7;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
              Sign In with Magic Link
            </a>
          </p>
          <p style="margin: 0 0 8px; color: #4b5563;">
            If the button doesn&apos;t work, copy and paste this URL into your browser:
          </p>
          <p style="margin: 0; color: #0369a1; word-break: break-all;">${url}</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to send magic link email. ${body}`);
  }
}

async function buildSessionUser(userId?: string | null, email?: string | null) {
  if (!userId && !email) return null;

  return prisma.user.findFirst({
    where: userId ? { id: userId } : { email: email ?? undefined },
    include: {
      technician: { select: { id: true } },
      tenant: { select: { name: true } },
      dentalAccount: { select: { name: true } },
      tenantAccesses: {
        select: {
          tenantId: true,
          dentalAccountId: true,
          isDefault: true,
          tenant: { select: { name: true } },
          dentalAccount: { select: { name: true } },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}

function mapTenantAccesses(
  tenantAccesses:
    | Array<{
        tenantId: string;
        dentalAccountId: string | null;
        isDefault: boolean;
        tenant: { name: string };
        dentalAccount: { name: string } | null;
      }>
    | undefined
): SessionTenantAccess[] {
  return (tenantAccesses ?? []).map((access) => ({
    tenantId: access.tenantId,
    tenantName: access.tenant.name,
    dentalAccountId: access.dentalAccountId ?? null,
    dentalAccountName: access.dentalAccount?.name ?? null,
    isDefault: access.isDefault,
  }));
}

function withLegacyDoctorAccess(
  user: {
    role: string;
    tenantId: string | null;
    dentalAccountId: string | null;
    tenant?: { name: string } | null;
    dentalAccount?: { name: string } | null;
  },
  accesses: SessionTenantAccess[]
) {
  if (user.role !== "DOCTOR" || accesses.length > 0 || !user.tenantId || !user.dentalAccountId) {
    return accesses;
  }

  return [
    {
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? "Dental Lab",
      dentalAccountId: user.dentalAccountId,
      dentalAccountName: user.dentalAccount?.name ?? null,
      isDefault: true,
    },
  ];
}

function pickDefaultTenantAccess(accesses: SessionTenantAccess[]) {
  return accesses.find((access) => access.isDefault) ?? accesses[0] ?? null;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      from: process.env.RESEND_FROM_EMAIL,
      maxAge: 15 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLinkEmail({ identifier, url });
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            technician: { select: { id: true } },
            tenant: { select: { name: true } },
            dentalAccount: { select: { name: true } },
            tenantAccesses: {
              select: {
                tenantId: true,
                dentalAccountId: true,
                isDefault: true,
                tenant: { select: { name: true } },
                dentalAccount: { select: { name: true } },
              },
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });
        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          dentalAccountId: user.dentalAccountId,
          technicianId: user.technician?.id ?? null,
          tenantAccesses: mapTenantAccesses(user.tenantAccesses),
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "email") {
        return true;
      }

      const targetEmail = user.email;
      if (!targetEmail) {
        return false;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: targetEmail },
        select: { id: true },
      });

      // Allow magic links only for already-provisioned users.
      return Boolean(existingUser);
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as { id?: string }).id ?? token.sub;
      }

      const dbUser = await buildSessionUser(token.sub as string | undefined, token.email ?? null);
      if (dbUser) {
        const tenantAccesses = withLegacyDoctorAccess(
          dbUser,
          mapTenantAccesses(dbUser.tenantAccesses)
        );
        const defaultAccess = pickDefaultTenantAccess(tenantAccesses);

        token.email = dbUser.email;
        token.name = dbUser.name ?? token.name;
        token.role = dbUser.role;
        token.tenantAccesses = tenantAccesses;
        token.tenantId = dbUser.role === "DOCTOR" ? defaultAccess?.tenantId ?? null : dbUser.tenantId;
        token.dentalAccountId =
          dbUser.role === "DOCTOR" ? defaultAccess?.dentalAccountId ?? null : dbUser.dentalAccountId;
        token.technicianId = dbUser.technician?.id ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { tenantId?: string | null }).tenantId =
          token.tenantId as string | null;
        (session.user as { dentalAccountId?: string | null }).dentalAccountId =
          token.dentalAccountId as string | null;
        (session.user as { technicianId?: string | null }).technicianId =
          token.technicianId as string | null;
        (session.user as { tenantAccesses?: SessionTenantAccess[] }).tenantAccesses =
          (token.tenantAccesses as SessionTenantAccess[] | undefined) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
