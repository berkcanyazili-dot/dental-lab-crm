import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const existing = await prisma.technician.findUnique({ where: { id: params.id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const tech = await prisma.technician.update({ where: { id: params.id }, data: body });
    return NextResponse.json(tech);
  } catch {
    return NextResponse.json({ error: "Failed to update technician" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.technician.findUnique({ where: { id: params.id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.technician.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete technician" }, { status: 500 });
  }
}
