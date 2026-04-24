import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookHmac, mapOrderToCase } from "@/lib/shopify";

// Shopify webhooks send raw bodies — must read as text before parsing
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";

  if (!verifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (topic !== "orders/create") {
    return NextResponse.json({ received: true, skipped: true });
  }

  let order: Record<string, unknown>;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shopifyOrderId = String(order.id);

  // Idempotent — skip if already recorded
  const existing = await prisma.shopifyOrder.findUnique({
    where: { shopifyOrderId },
  });
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  const shopifyRecord = await prisma.shopifyOrder.create({
    data: {
      shopifyOrderId,
      shopifyOrderNumber: String(order.order_number),
      status: "PENDING",
      customerName: (() => {
        const c = order.customer as { first_name?: string; last_name?: string } | null;
        return c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : null;
      })(),
      customerEmail: (order.customer as { email?: string } | null)?.email ?? null,
      totalPrice: parseFloat(String(order.total_price ?? "0")) || 0,
      itemCount: (order.line_items as unknown[])?.length ?? 0,
      tags: String(order.tags ?? ""),
      rawData: rawBody,
      shopifyCreatedAt: new Date(String(order.created_at)),
    },
  });

  // Auto-create case if a default account is configured
  const defaultAccountId = process.env.SHOPIFY_DEFAULT_ACCOUNT_ID;
  if (defaultAccountId) {
    try {
      const account = await prisma.dentalAccount.findUnique({
        where: { id: defaultAccountId },
      });
      if (account) {
        const { items, ...caseFields } = mapOrderToCase(order as unknown as Parameters<typeof mapOrderToCase>[0]);
        const count = await prisma.case.count();
        const caseNumber = `DL-${String(count + 1).padStart(5, "0")}`;
        const totalValue = items.reduce((s, i) => s + i.price * i.units, 0);

        const newCase = await prisma.case.create({
          data: {
            ...caseFields,
            caseNumber,
            dentalAccountId: defaultAccountId,
            totalValue,
            status: "INCOMING",
            caseType: "NEW",
            caseOrigin: "SHOPIFY",
            items: { create: items },
            audits: {
              create: [
                {
                  action: "CASE_CREATED",
                  details: `Auto-created from Shopify order #${shopifyRecord.shopifyOrderNumber}`,
                  authorName: "Shopify Webhook",
                },
              ],
            },
          },
        });

        await prisma.shopifyOrder.update({
          where: { id: shopifyRecord.id },
          data: { status: "IMPORTED", caseId: newCase.id, importedAt: new Date() },
        });
      }
    } catch {
      // Don't fail the webhook response if case creation errors
    }
  }

  return NextResponse.json({ received: true });
}
