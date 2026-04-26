import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTenant } from "@/server/services/tenant";

export async function GET() {
  try {
    const sessionTenant = await getSessionTenant();
    if (!sessionTenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const techs = await prisma.technician.findMany({
      where: { tenantId: sessionTenant.tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { cases: true } } },
    });
    return NextResponse.json(techs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch technicians" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionTenant = await getSessionTenant();
    if (!sessionTenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const tech = await prisma.technician.create({
      data: { ...body, tenantId: sessionTenant.tenantId },
    });
    return NextResponse.json(tech, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create technician" }, { status: 500 });
  }
}
