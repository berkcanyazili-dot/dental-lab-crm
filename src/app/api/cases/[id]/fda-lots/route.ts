import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";

const createFdaLotSchema = z
  .object({
    itemName: z.string().trim().min(1),
    manufacturer: z.string().trim().optional().nullable(),
    lotNumber: z.string().trim().min(1),
  })
  .strict();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const lots = await prisma.fDALot.findMany({
    where: { caseId: params.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(lots);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = createFdaLotSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid FDA lot payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const authorName = await getSessionAuthorName();
  const { itemName, manufacturer, lotNumber } = parsed.data;

  const maxOrder = await prisma.fDALot.aggregate({
    where: { caseId: params.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const lot = await prisma.fDALot.create({
    data: {
      caseId: params.id,
      itemName,
      manufacturer: manufacturer || null,
      lotNumber,
      userName: authorName,
      sortOrder,
    },
  });

  await prisma.caseAudit.create({
    data: {
      caseId: params.id,
      action: "FDA_LOT_ADDED",
      details: `${itemName} / ${lotNumber}`,
      authorName,
    },
  });

  return NextResponse.json(lot, { status: 201 });
}
