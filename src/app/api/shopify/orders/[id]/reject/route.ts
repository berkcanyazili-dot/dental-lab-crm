import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await prisma.shopifyOrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "PENDING")
    return NextResponse.json({ error: "Already processed" }, { status: 400 });

  await prisma.shopifyOrder.update({
    where: { id: params.id },
    data: { status: "REJECTED" },
  });
  return NextResponse.json({ success: true });
}
