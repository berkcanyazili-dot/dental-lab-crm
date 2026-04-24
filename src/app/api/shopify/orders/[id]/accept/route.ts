import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapOrderToCase } from "@/lib/shopify";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const shopifyOrder = await prisma.shopifyOrder.findUnique({
    where: { id: params.id },
  });
  if (!shopifyOrder)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (shopifyOrder.status !== "PENDING")
    return NextResponse.json({ error: "Already processed" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { dentalAccountId, overrides } = body as {
    dentalAccountId: string;
    overrides?: Record<string, unknown>;
  };

  if (!dentalAccountId)
    return NextResponse.json(
      { error: "dentalAccountId is required" },
      { status: 400 }
    );

  const rawOrder = JSON.parse(shopifyOrder.rawData);
  const { items, ...caseFields } = mapOrderToCase(rawOrder);

  const count = await prisma.case.count();
  const caseNumber = `DL-${String(count + 1).padStart(5, "0")}`;
  const totalValue = items.reduce((s, i) => s + i.price * i.units, 0);

  const newCase = await prisma.case.create({
    data: {
      ...caseFields,
      ...(overrides ?? {}),
      caseNumber,
      dentalAccountId,
      totalValue,
      status: "INCOMING",
      caseType: "NEW",
      caseOrigin: "SHOPIFY",
      items: { create: items },
      audits: {
        create: [
          {
            action: "CASE_CREATED",
            details: `Imported from Shopify order #${shopifyOrder.shopifyOrderNumber}`,
            authorName: "Shopify Import",
          },
        ],
      },
    },
    include: { dentalAccount: true, items: true },
  });

  await prisma.shopifyOrder.update({
    where: { id: params.id },
    data: { status: "IMPORTED", caseId: newCase.id, importedAt: new Date() },
  });

  return NextResponse.json(newCase, { status: 201 });
}
