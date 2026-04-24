import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillShopifyOrder, isConfigured } from "@/lib/shopify";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
      caseNotes: { orderBy: { createdAt: "desc" } },
      schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { _authorName, ...body } = await request.json();
  const authorName = _authorName ?? "Staff";

  const before = await prisma.case.findUnique({ where: { id: params.id } });
  const updated = await prisma.case.update({
    where: { id: params.id },
    data: body,
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
      caseNotes: { orderBy: { createdAt: "desc" } },
      schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  const changedFields = Object.keys(body)
    .filter((k) => body[k] !== (before as Record<string, unknown>)?.[k])
    .join(", ");

  if (changedFields) {
    await prisma.caseAudit.create({
      data: {
        caseId: params.id,
        action: "CASE_UPDATED",
        details: changedFields,
        authorName,
      },
    });
  }

  // Auto-fulfill linked Shopify order when case is marked SHIPPED
  if (body.status === "SHIPPED" && before?.status !== "SHIPPED" && isConfigured()) {
    try {
      const shopifyOrder = await prisma.shopifyOrder.findUnique({
        where: { caseId: params.id },
      });
      if (shopifyOrder) {
        await fulfillShopifyOrder(
          shopifyOrder.shopifyOrderId,
          updated.shippingCarrier,
          undefined
        );
        await prisma.caseAudit.create({
          data: {
            caseId: params.id,
            action: "SHOPIFY_FULFILLED",
            details: `Shopify order #${shopifyOrder.shopifyOrderNumber} marked fulfilled`,
            authorName,
          },
        });
      }
    } catch (e) {
      // Log but don't fail the case update if Shopify fulfillment errors
      console.error("Shopify fulfillment error:", e);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.case.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
