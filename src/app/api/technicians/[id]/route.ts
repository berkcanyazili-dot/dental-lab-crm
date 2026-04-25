import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const tech = await prisma.technician.update({ where: { id: params.id }, data: body });
    return NextResponse.json(tech);
  } catch {
    return NextResponse.json({ error: "Failed to update technician" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.$transaction([
      // TechActivity has RESTRICT on delete, so clear it first
      prisma.techActivity.deleteMany({ where: { technicianId: params.id } }),
      prisma.technician.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete technician" }, { status: 500 });
  }
}
