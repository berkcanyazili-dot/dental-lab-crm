import { NextResponse } from "next/server";
import { syncRecentShopifyOrders } from "@/server/services/shopifyImport";

export async function POST() {
  try {
    return NextResponse.json(await syncRecentShopifyOrders(24));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
