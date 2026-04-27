import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, type SessionTenantAccess } from "@/lib/auth";
import { ACTIVE_PORTAL_TENANT_COOKIE } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export interface DoctorSession {
  userId: string;
  name?: string | null;
  email?: string | null;
  tenantId: string;
  tenantName: string;
  dentalAccountId: string;
  dentalAccountName: string | null;
  accessibleLabs: SessionTenantAccess[];
}

function chooseActiveAccess(
  accesses: SessionTenantAccess[],
  requestedTenantId?: string | null
) {
  if (requestedTenantId) {
    const requestedAccess = accesses.find((access) => access.tenantId === requestedTenantId);
    if (requestedAccess) {
      return requestedAccess;
    }
  }

  return accesses.find((access) => access.isDefault) ?? accesses[0] ?? null;
}

export async function getDoctorSession(): Promise<DoctorSession | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        role?: string;
        tenantAccesses?: SessionTenantAccess[];
      }
    | undefined;

  if (!user?.id || user.role !== "DOCTOR") {
    return null;
  }

  let tenantAccesses = (user.tenantAccesses ?? []).filter((access) => Boolean(access.dentalAccountId));

  if (tenantAccesses.length === 0) {
    const dbAccesses = await prisma.tenantMember.findMany({
        where: {
          userId: user.id,
          dentalAccountId: { not: null },
        },
        select: {
          tenantId: true,
          dentalAccountId: true,
          isDefault: true,
          tenant: { select: { name: true } },
          dentalAccount: { select: { name: true } },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });

    tenantAccesses = dbAccesses.map((access) => ({
      tenantId: access.tenantId,
      tenantName: access.tenant.name,
      dentalAccountId: access.dentalAccountId,
      dentalAccountName: access.dentalAccount?.name ?? null,
      isDefault: access.isDefault,
    }));
  }

  const cookieStore = await cookies();
  const requestedTenantId = cookieStore.get(ACTIVE_PORTAL_TENANT_COOKIE)?.value ?? null;
  const activeAccess = chooseActiveAccess(tenantAccesses, requestedTenantId);

  if (!activeAccess?.dentalAccountId) {
    return null;
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    tenantId: activeAccess.tenantId,
    tenantName: activeAccess.tenantName,
    dentalAccountId: activeAccess.dentalAccountId,
    dentalAccountName: activeAccess.dentalAccountName,
    accessibleLabs: tenantAccesses,
  };
}
