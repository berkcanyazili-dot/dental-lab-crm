import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const techs = await prisma.technician.findMany({
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
    const body = await request.json();
    const tech = await prisma.technician.create({ data: body });
    return NextResponse.json(tech, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create technician" }, { status: 500 });
  }
}
