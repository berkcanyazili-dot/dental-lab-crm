import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";

const createFdaLotSchema = z
  .object({
    itemName: z.string().trim().min(1),
    manufacturer: z.string().trim().optional().nullable(),
    lotNumber: z.string().trim().min(1),
    caseItemId: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

function buildCaseLookupWhere(rawId: string): Prisma.CaseWhereInput {
  const normalized = rawId.trim();

  return {
    OR: [
      { id: normalized },
      { caseNumber: normalized },
      { caseNumber: normalized.toUpperCase() },
    ],
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const existingCase = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id),
    select: { id: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const lots = await prisma.fDALot.findMany({
    where: { caseId: existingCase.id },
    include: {
      caseItem: {
        select: {
          id: true,
          productType: true,
          toothNumbers: true,
        },
      },
    },
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
  const { itemName, manufacturer, lotNumber, caseItemId } = parsed.data;

  const existingCase = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id),
    select: { id: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (caseItemId) {
    const matchingCaseItem = await prisma.caseItem.findFirst({
      where: {
        id: caseItemId,
        caseId: existingCase.id,
      },
      select: { id: true },
    });

    if (!matchingCaseItem) {
      return NextResponse.json(
        { error: "Selected case item does not belong to this case." },
        { status: 400 }
      );
    }
  }

  const maxOrder = await prisma.fDALot.aggregate({
    where: { caseId: existingCase.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const lot = await prisma.fDALot.create({
    data: {
      caseId: existingCase.id,
      caseItemId: caseItemId || null,
      itemName,
      manufacturer: manufacturer || null,
      lotNumber,
      userName: authorName,
      sortOrder,
    },
    include: {
      caseItem: {
        select: {
          id: true,
          productType: true,
          toothNumbers: true,
        },
      },
    },
  });

  await prisma.caseAudit.create({
    data: {
      caseId: existingCase.id,
      action: "FDA_LOT_ADDED",
      details: caseItemId ? `${itemName} / ${lotNumber} linked to case item` : `${itemName} / ${lotNumber}`,
      authorName,
    },
  });

  return NextResponse.json(lot, { status: 201 });
}
