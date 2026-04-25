import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getShopifySettings,
  isShopifyConfigured,
  testShopifyConnection,
  upsertShopifySettings,
} from "@/server/services/shopifyImport";

const shopifySettingsSchema = z
  .object({
    action: z.enum(["save", "test"]).optional(),
    storeUrl: z.string().trim().optional().nullable(),
    adminToken: z.string().trim().optional().nullable(),
    webhookSecret: z.string().trim().optional().nullable(),
    defaultAccountId: z.string().trim().optional().nullable(),
  })
  .strict();

export async function GET() {
  const settings = await getShopifySettings();

  return NextResponse.json({
    storeUrl: settings?.storeUrl ?? "",
    hasToken: !!settings?.adminToken,
    hasWebhookSecret: !!settings?.webhookSecret,
    defaultAccountId: settings?.defaultAccountId ?? "",
    configured: isShopifyConfigured(settings),
  });
}

export async function POST(req: NextRequest) {
  const parsed = shopifySettingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Shopify settings payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { action, storeUrl, adminToken, webhookSecret, defaultAccountId } = parsed.data;
  const savedSettings = await getShopifySettings();
  const nextSettings = {
    storeUrl: storeUrl !== undefined ? storeUrl : savedSettings?.storeUrl,
    adminToken: adminToken || savedSettings?.adminToken,
    webhookSecret: webhookSecret || savedSettings?.webhookSecret,
    defaultAccountId:
      defaultAccountId !== undefined ? defaultAccountId : savedSettings?.defaultAccountId,
  };

  if (action === "test") {
    try {
      const shop = await testShopifyConnection(nextSettings);
      return NextResponse.json({ ok: true, shop });
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 400 });
    }
  }

  const settings = await upsertShopifySettings({
    storeUrl,
    adminToken,
    webhookSecret,
    defaultAccountId,
  });

  return NextResponse.json({
    success: true,
    storeUrl: settings.storeUrl ?? "",
    hasToken: !!settings.adminToken,
    hasWebhookSecret: !!settings.webhookSecret,
    defaultAccountId: settings.defaultAccountId ?? "",
    configured: isShopifyConfigured(settings),
  });
}
