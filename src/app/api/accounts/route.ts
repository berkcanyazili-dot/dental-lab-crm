import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionTenant } from "@/server/services/tenant";

const createAccountSchema = z
  .object({
    name: z.string().trim().min(1),
    doctorName: z.string().trim().min(1).optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    phone: z.string().trim().min(1).optional().nullable(),
    fax: z.string().trim().min(1).optional().nullable(),
    address: z.string().trim().min(1).optional().nullable(),
    city: z.string().trim().min(1).optional().nullable(),
    state: z.string().trim().min(1).optional().nullable(),
    zip: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().min(1).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .strict();

const DEFAULT_LIMIT = 25;
const SEARCH_LIMIT = 12;

export async function GET(request: NextRequest) {
  try {
    const sessionTenant = await getSessionTenant();
    if (!sessionTenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const prisma = getTenantPrisma(sessionTenant.tenantId);
    const rawSearch = searchParams.get("search")?.trim() ?? "";
    const search = rawSearch.slice(0, 100);
    const parsedLimit = Number(searchParams.get("limit"));
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), 50)
      : search
        ? SEARCH_LIMIT
        : DEFAULT_LIMIT;

    const accounts = await prisma.dentalAccount.findMany({
      where: search
        ? {
            deletedAt: null,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { doctorName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : { deletedAt: null },
      orderBy: { name: "asc" },
      take: limit,
      include: { _count: { select: { cases: true } } },
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  const parsed = createAccountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid account payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const account = await prisma.dentalAccount.create({
      data: {
        ...parsed.data,
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
