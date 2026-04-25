import { NextRequest, NextResponse } from "next/server";
import { handleShopifyOrderWebhook } from "@/server/services/shopifyImport";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";

  try {
    const result = await handleShopifyOrderWebhook(rawBody, hmac, topic);
    if (result.status === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
