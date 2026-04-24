import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRecentOrders, isConfigured } from "@/lib/shopify";

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Shopify not configured. Add credentials in Settings." },
      { status: 400 }
    );
  }

  try {
    const orders = await fetchRecentOrders(24);
    let newCount = 0;

    for (const order of orders) {
      const existing = await prisma.shopifyOrder.findUnique({
        where: { shopifyOrderId: String(order.id) },
      });
      if (existing) continue;

      await prisma.shopifyOrder.create({
        data: {
          shopifyOrderId: String(order.id),
          shopifyOrderNumber: String(order.order_number),
          status: "PENDING",
          customerName: order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : null,
          customerEmail: order.customer?.email ?? null,
          totalPrice: parseFloat(order.total_price) || 0,
          itemCount: order.line_items?.length ?? 0,
          tags: order.tags ?? "",
          rawData: JSON.stringify(order),
          shopifyCreatedAt: new Date(order.created_at),
        },
      });
      newCount++;
    }

    return NextResponse.json({ fetched: orders.length, imported: newCount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
