import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  const lots = await prisma.fDALot.findMany({
    where: { caseId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(lots);
}

export async function POST(req: NextRequest) {
  const { caseId, itemName, manufacturer, lotNumber, userName } = await req.json();
  if (!caseId || !itemName || !lotNumber) {
    return NextResponse.json({ error: "caseId, itemName, and lotNumber are required" }, { status: 400 });
  }

  const maxOrder = await prisma.fDALot.aggregate({
    where: { caseId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const lot = await prisma.fDALot.create({
    data: { caseId, itemName, manufacturer: manufacturer || null, lotNumber, userName: userName || "Staff", sortOrder },
  });
  return NextResponse.json(lot, { status: 201 });
}
