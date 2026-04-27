import crypto from "crypto";
import { Prisma, ShopifyOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapOrderToCase, type ShopifyOrderRaw } from "@/lib/shopify";
import { createCaseWithTx } from "./cases";

const API_VERSION = "2024-01";

export interface ShopifySettingsInput {
  storeUrl?: string | null;
  adminToken?: string | null;
  webhookSecret?: string | null;
  defaultAccountId?: string | null;
}

async function resolveFallbackTenantId() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) {
    throw new Error("No tenant found.");
  }
  return tenant.id;
}

function normalizeHost(storeUrl?: string | null) {
  return (storeUrl ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null;
}

export async function getShopifySettings(tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await resolveFallbackTenantId());
  return prisma.shopifySettings.findUnique({ where: { tenantId: resolvedTenantId } });
}

export function isShopifyConfigured(settings: ShopifySettingsInput | null) {
  return !!(settings?.storeUrl && settings.adminToken);
}

export async function upsertShopifySettings(input: ShopifySettingsInput, tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await resolveFallbackTenantId());
  return prisma.shopifySettings.upsert({
    where: { tenantId: resolvedTenantId },
    update: {
      ...(input.storeUrl !== undefined ? { storeUrl: input.storeUrl || null } : {}),
      ...(input.adminToken !== undefined ? { adminToken: input.adminToken || null } : {}),
      ...(input.webhookSecret !== undefined ? { webhookSecret: input.webhookSecret || null } : {}),
      ...(input.defaultAccountId !== undefined ? { defaultAccountId: input.defaultAccountId || null } : {}),
    },
    create: {
      tenantId: resolvedTenantId,
      storeUrl: input.storeUrl || null,
      adminToken: input.adminToken || null,
      webhookSecret: input.webhookSecret || null,
      defaultAccountId: input.defaultAccountId || null,
    },
  });
}

export async function shopifyFetchWithSettings(
  settings: ShopifySettingsInput,
  path: string,
  options: RequestInit = {}
) {
  const host = normalizeHost(settings.storeUrl);
  if (!host || !settings.adminToken) {
    throw new Error("Shopify credentials not configured.");
  }

  const res = await fetch(`https://${host}/admin/api/${API_VERSION}${path}`, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": settings.adminToken,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Shopify ${res.status}: ${text}`);
  }

  return res.json();
}

export async function testShopifyConnection(settings?: ShopifySettingsInput | null) {
  const savedSettings = settings ?? (await getShopifySettings());
  if (!savedSettings) {
    throw new Error("Shopify credentials not configured.");
  }
  const data = await shopifyFetchWithSettings(savedSettings, "/shop.json");
  return { name: data.shop?.name, email: data.shop?.email, domain: data.shop?.domain };
}

export async function fetchRecentShopifyOrders(hoursBack = 24) {
  const settings = await getShopifySettings();
  if (!isShopifyConfigured(settings)) {
    throw new Error("Shopify not configured. Add credentials in Settings.");
  }

  const since = new Date(Date.now() - hoursBack * 3_600_000).toISOString();
  const data = await shopifyFetchWithSettings(
    settings as ShopifySettingsInput,
    `/orders.json?status=any&created_at_min=${encodeURIComponent(since)}&limit=250`
  );
  return (data.orders ?? []) as ShopifyOrderRaw[];
}

function shopifyOrderCreateData(order: ShopifyOrderRaw | Record<string, unknown>) {
  const customer = order.customer as { first_name?: string; last_name?: string; email?: string } | null;
  const lineItems = (order.line_items as unknown[]) ?? [];

  return {
    shopifyOrderId: String(order.id),
    shopifyOrderNumber: String(order.order_number),
    status: ShopifyOrderStatus.PENDING,
    customerName: customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : null,
    customerEmail: customer?.email ?? null,
    totalPrice: new Prisma.Decimal(String(order.total_price ?? "0")),
    itemCount: lineItems.length,
    tags: String(order.tags ?? ""),
    rawData: typeof order === "string" ? order : JSON.stringify(order),
    shopifyCreatedAt: new Date(String(order.created_at)),
  };
}

export async function recordShopifyOrder(order: ShopifyOrderRaw | Record<string, unknown>) {
  const shopifyOrderId = String(order.id);
  const existing = await prisma.shopifyOrder.findUnique({ where: { shopifyOrderId } });
  if (existing) return { order: existing, created: false };

  const created = await prisma.shopifyOrder.create({
    data: shopifyOrderCreateData(order),
  });
  return { order: created, created: true };
}

export async function syncRecentShopifyOrders(hoursBack = 24) {
  const orders = await fetchRecentShopifyOrders(hoursBack);
  let imported = 0;

  for (const order of orders) {
    const result = await recordShopifyOrder(order);
    if (result.created) imported++;
  }

  return { fetched: orders.length, imported };
}

export async function importShopifyOrderAsCase(
  shopifyOrderId: string,
  dentalAccountId: string,
  overrides: Record<string, unknown> = {}
) {
  const shopifyOrder = await prisma.shopifyOrder.findUnique({
    where: { id: shopifyOrderId },
  });
  if (!shopifyOrder) return null;
  if (shopifyOrder.status !== ShopifyOrderStatus.PENDING) {
    throw new Error("Already processed");
  }

  const rawOrder = JSON.parse(shopifyOrder.rawData) as ShopifyOrderRaw;
  const { items, ...caseFields } = mapOrderToCase(rawOrder);
  const account = await prisma.dentalAccount.findUnique({
    where: { id: dentalAccountId },
    select: { tenantId: true },
  });
  if (!account) return null;
  const accountTenantId = account.tenantId ?? (await resolveFallbackTenantId());

  return prisma.$transaction(async (tx) => {
    const newCase = await createCaseWithTx(
      tx,
      {
        tenantId: accountTenantId,
        ...caseFields,
        ...overrides,
        dentalAccountId,
        status: "INCOMING",
        caseType: "NEW",
        caseOrigin: "SHOPIFY",
        items,
        auditAuthorName: "Shopify Import",
        auditDetails: `Imported from Shopify order #${shopifyOrder.shopifyOrderNumber}`,
      },
      { dentalAccount: true, items: true }
    );

    await tx.shopifyOrder.update({
      where: { id: shopifyOrderId },
      data: { status: ShopifyOrderStatus.IMPORTED, caseId: newCase.id, importedAt: new Date() },
    });

    return newCase;
  });
}

async function findOrCreateShopifyDentalAccount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  order: ShopifyOrderRaw,
  defaultAccountId?: string | null
) {
  const normalizedEmail = normalizeEmail(order.customer?.email);

  if (normalizedEmail) {
    const existingByEmail = await tx.dentalAccount.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingByEmail) {
      return existingByEmail.id;
    }

    const createdAccount = await tx.dentalAccount.create({
      data: {
        tenantId,
        name:
          `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim() ||
          normalizedEmail,
        doctorName:
          `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim() || null,
        email: normalizedEmail,
        phone: order.shipping_address?.phone ?? null,
        address: order.shipping_address?.address1 ?? null,
        city: order.shipping_address?.city ?? null,
        state: order.shipping_address?.province ?? null,
        zip: order.shipping_address?.zip ?? null,
        notes: "Auto-created from Shopify customer import",
      },
      select: { id: true },
    });

    return createdAccount.id;
  }

  if (defaultAccountId) {
    const existingDefaultAccount = await tx.dentalAccount.findFirst({
      where: {
        id: defaultAccountId,
        tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingDefaultAccount) {
      return existingDefaultAccount.id;
    }
  }

  throw new Error("No matching dental account could be resolved for Shopify order.");
}

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string, webhookSecret?: string | null) {
  if (!webhookSecret) return true;
  try {
    const digest = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("base64");
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function handleShopifyOrderWebhook(rawBody: string, hmacHeader: string, topic: string) {
  const settings = await getShopifySettings();
  if (!verifyShopifyWebhook(rawBody, hmacHeader, settings?.webhookSecret)) {
    return { status: "unauthorized" as const };
  }

  if (topic !== "orders/create") {
    return { status: "skipped" as const };
  }

  const order = JSON.parse(rawBody) as Record<string, unknown>;
  const result = await recordShopifyOrder(order);
  if (!result.created) return { status: "duplicate" as const };

  if (!settings?.defaultAccountId) {
    return { status: "recorded" as const };
  }

  const account = await prisma.dentalAccount.findUnique({
    where: { id: settings.defaultAccountId },
  });
  if (!account) return { status: "recorded" as const };

  const rawShopifyOrder = order as unknown as ShopifyOrderRaw;
  const { items, ...caseFields } = mapOrderToCase(rawShopifyOrder);
  const accountTenantId = account.tenantId ?? (await resolveFallbackTenantId());
  await prisma.$transaction(async (tx) => {
    const resolvedDentalAccountId = await findOrCreateShopifyDentalAccount(
      tx,
      accountTenantId,
      rawShopifyOrder,
      settings.defaultAccountId
    );

    const newCase = await createCaseWithTx(tx, {
      tenantId: accountTenantId,
      ...caseFields,
      dentalAccountId: resolvedDentalAccountId,
      status: "INCOMING",
      caseType: "NEW",
      caseOrigin: "SHOPIFY",
      items,
      auditAuthorName: "Shopify Webhook",
      auditDetails: `Auto-created from Shopify order #${result.order.shopifyOrderNumber}`,
    });

    await tx.shopifyOrder.update({
      where: { id: result.order.id },
      data: { status: ShopifyOrderStatus.IMPORTED, caseId: newCase.id, importedAt: new Date() },
    });
  });

  return { status: "imported" as const };
}
