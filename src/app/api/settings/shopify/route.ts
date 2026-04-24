import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/shopify";

// On Vercel the filesystem is read-only, so we can only read env vars that
// were set at deploy time. The GET endpoint returns current runtime values,
// and POST updates process.env in-memory for the current invocation only.
// To persist Shopify credentials on Vercel, set them in the Vercel dashboard.

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

  // Update process.env for the lifetime of this serverless invocation.
  // On Vercel, set these permanently via the Vercel dashboard → Settings → Environment Variables.
  if (storeUrl !== undefined) process.env.SHOPIFY_STORE_URL = storeUrl;
  if (adminToken) process.env.SHOPIFY_ADMIN_TOKEN = adminToken;
  if (webhookSecret) process.env.SHOPIFY_WEBHOOK_SECRET = webhookSecret;
  if (defaultAccountId !== undefined) process.env.SHOPIFY_DEFAULT_ACCOUNT_ID = defaultAccountId;

  // Try to persist to .env for local development only
  try {
    const fs = await import("fs");
    const path = await import("path");
    const ENV_PATH = path.join(process.cwd(), ".env");

    function parseEnv(content: string): Record<string, string> {
      const map: Record<string, string> = {};
      for (const line of content.split("\n")) {
        const match = line.match(/^([^#=\s][^=]*?)=(.*)$/);
        if (!match) continue;
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        map[key] = val;
      }
      return map;
    }

    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
    const vars = parseEnv(content);

    if (storeUrl !== undefined) vars.SHOPIFY_STORE_URL = storeUrl;
    if (adminToken) vars.SHOPIFY_ADMIN_TOKEN = adminToken;
    if (webhookSecret) vars.SHOPIFY_WEBHOOK_SECRET = webhookSecret;
    if (defaultAccountId !== undefined) vars.SHOPIFY_DEFAULT_ACCOUNT_ID = defaultAccountId;

    const serialized = Object.entries(vars).map(([k, v]) => `${k}="${v}"`).join("\n") + "\n";
    fs.writeFileSync(ENV_PATH, serialized, "utf8");
  } catch {
    // Silently ignore on Vercel (read-only filesystem)
  }

  return NextResponse.json({ success: true });
}
