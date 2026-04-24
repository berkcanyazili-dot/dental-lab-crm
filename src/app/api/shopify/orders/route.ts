import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const orders = await prisma.shopifyOrder.findMany({
    where: { status },
    orderBy: { shopifyCreatedAt: "desc" },
    include: {
      case: { select: { id: true, caseNumber: true } },
    },
  });
  return NextResponse.json(orders);
}
