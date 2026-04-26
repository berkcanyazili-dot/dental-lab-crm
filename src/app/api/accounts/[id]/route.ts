import { NextRequest, NextResponse } from "next/server";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionTenant } from "@/server/services/tenant";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const prisma = getTenantPrisma(sessionTenant.tenantId);
    const account = await prisma.dentalAccount.findUnique({
      where: { id: params.id },
      include: {
        cases: {
          where: { deletedAt: null },
          include: { items: { where: { deletedAt: null } } },
          orderBy: { receivedDate: "desc" },
        },
      },
    });
    if (!account || account.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: "Failed to fetch account" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const prisma = getTenantPrisma(sessionTenant.tenantId);
    const body = await request.json();
    const existing = await prisma.dentalAccount.findUnique({ where: { id: params.id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.dentalAccount.update({ where: { id: params.id }, data: body });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const prisma = getTenantPrisma(sessionTenant.tenantId);
    const existing = await prisma.dentalAccount.findUnique({ where: { id: params.id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.dentalAccount.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
