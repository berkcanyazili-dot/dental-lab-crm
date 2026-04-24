import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/shopify";

function parseEnv(content: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=\s][^=]*?)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function serializeEnv(vars: Record<string, string>): string {
  return Object.entries(vars).map(([k, v]) => `${k}="${v}"`).join("\n") + "\n";
}

// On Vercel the filesystem is read-only — env vars set here persist only for
// the current serverless invocation. Set them permanently in the Vercel dashboard.

export async function GET() {
  return NextResponse.json({
    storeUrl: process.env.SHOPIFY_STORE_URL ?? "",
    hasToken: !!process.env.SHOPIFY_ADMIN_TOKEN,
    hasWebhookSecret: !!process.env.SHOPIFY_WEBHOOK_SECRET,
    defaultAccountId: process.env.SHOPIFY_DEFAULT_ACCOUNT_ID ?? "",
    configured: !!(process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ADMIN_TOKEN),
  });
}

export async function POST(req: NextRequest) {
  const { action, storeUrl, adminToken, webhookSecret, defaultAccountId } =
    await req.json();

  if (action === "test") {
    try {
      const shop = await testConnection();
      return NextResponse.json({ ok: true, shop });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
    }
  }

  // Update process.env for the lifetime of this serverless invocation
  if (storeUrl !== undefined) process.env.SHOPIFY_STORE_URL = storeUrl;
  if (adminToken) process.env.SHOPIFY_ADMIN_TOKEN = adminToken;
  if (webhookSecret) process.env.SHOPIFY_WEBHOOK_SECRET = webhookSecret;
  if (defaultAccountId !== undefined) process.env.SHOPIFY_DEFAULT_ACCOUNT_ID = defaultAccountId;

  // Persist to .env for local development only (silently ignored on Vercel)
  try {
    const fs = await import("fs");
    const path = await import("path");
    const ENV_PATH = path.join(process.cwd(), ".env");
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
    const vars = parseEnv(content);
    if (storeUrl !== undefined) vars.SHOPIFY_STORE_URL = storeUrl;
    if (adminToken) vars.SHOPIFY_ADMIN_TOKEN = adminToken;
    if (webhookSecret) vars.SHOPIFY_WEBHOOK_SECRET = webhookSecret;
    if (defaultAccountId !== undefined) vars.SHOPIFY_DEFAULT_ACCOUNT_ID = defaultAccountId;
    fs.writeFileSync(ENV_PATH, serializeEnv(vars), "utf8");
  } catch {
    // Read-only filesystem on Vercel — expected
  }

  return NextResponse.json({ success: true });
}
