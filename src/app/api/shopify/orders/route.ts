import { NextRequest, NextResponse } from "next/server";
import { ShopifyOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SHOPIFY_ORDER_STATUSES = Object.values(ShopifyOrderStatus);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status") ?? "PENDING";
  if (!SHOPIFY_ORDER_STATUSES.includes(rawStatus as ShopifyOrderStatus)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }
  const status = rawStatus as ShopifyOrderStatus;

  const orders = await prisma.shopifyOrder.findMany({
    where: { status },
    orderBy: { shopifyCreatedAt: "desc" },
    include: {
      case: { select: { id: true, caseNumber: true } },
    },
  });
  return NextResponse.json(orders);
}
