import crypto from "crypto";
import { PriorityLevel } from "@prisma/client";

const API_VERSION = "2024-01";

/* ─── Types ──────────────────────────────────────────────────── */
export interface ShopifyLineItem {
  id: string | number;
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
  variant_title: string | null;
}

export interface ShopifyOrderRaw {
  id: number;
  order_number: number;
  created_at: string;
  tags: string;
  note: string | null;
  total_price: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  shipping_address: {
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string | null;
  } | null;
  line_items: ShopifyLineItem[];
}

/* ─── Internal helpers ───────────────────────────────────────── */
function getHost() {
  const url = process.env.SHOPIFY_STORE_URL ?? "";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function getToken() {
  return process.env.SHOPIFY_ADMIN_TOKEN ?? "";
}

export function isConfigured() {
  return !!(process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ADMIN_TOKEN);
}

/* ─── Core fetch wrapper ─────────────────────────────────────── */
export async function shopifyFetch(path: string, options: RequestInit = {}) {
  const host = getHost();
  const token = getToken();
  if (!host || !token) throw new Error("Shopify credentials not configured.");

  const url = `https://${host}/admin/api/${API_VERSION}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": token,
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

/* ─── Order operations ───────────────────────────────────────── */
export async function fetchRecentOrders(hoursBack = 24): Promise<ShopifyOrderRaw[]> {
  const since = new Date(Date.now() - hoursBack * 3_600_000).toISOString();
  const data = await shopifyFetch(
    `/orders.json?status=any&created_at_min=${encodeURIComponent(since)}&limit=250`
  );
  return (data.orders ?? []) as ShopifyOrderRaw[];
}

export async function testConnection(): Promise<{ name: string; email: string; domain: string }> {
  const data = await shopifyFetch("/shop.json");
  return { name: data.shop?.name, email: data.shop?.email, domain: data.shop?.domain };
}

export async function fulfillShopifyOrder(
  shopifyOrderId: string,
  carrier?: string | null,
  trackingNumber?: string | null
) {
  // Step 1: get fulfillment order id
  const foData = await shopifyFetch(`/orders/${shopifyOrderId}/fulfillment_orders.json`);
  const fulfillmentOrderId = foData.fulfillment_orders?.[0]?.id;
  if (!fulfillmentOrderId) throw new Error("No open fulfillment order found on Shopify");

  // Step 2: create fulfillment
  const body: Record<string, unknown> = {
    fulfillment: {
      line_items_by_fulfillment_order: [{ fulfillment_order_id: fulfillmentOrderId }],
      notify_customer: true,
    },
  };
  if (carrier) {
    (body.fulfillment as Record<string, unknown>).tracking_info = {
      company: carrier,
      number: trackingNumber ?? "",
    };
  }

  return shopifyFetch("/fulfillments.json", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ─── Webhook HMAC verification ─────────────────────────────── */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification if no secret configured
  try {
    const digest = crypto
      .createHmac("sha256", secret)
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

/* ─── Order → Case mapping ───────────────────────────────────── */
export function mapOrderToCase(order: ShopifyOrderRaw) {
  const tags = (order.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const isRush = tags.some((t) => t === "rush" || t === "emergency");
  const panTag = tags.find((t) => /^pan[-\s]/.test(t));
  const pan = panTag ? panTag.replace(/^pan[-\s]/, "").trim() || null : null;

  const items = (order.line_items ?? []).map((li) => ({
    productType: li.title,
    units: li.quantity,
    price: parseFloat(li.price) || 0,
    shade: li.variant_title ?? null,
  }));

  const addr = order.shipping_address;
  const shippingAddress = addr
    ? [addr.address1, addr.address2, addr.city, addr.province, addr.zip]
        .filter(Boolean)
        .join(", ")
    : null;

  return {
    patientFirst: order.customer?.first_name ?? "",
    patientLast: order.customer?.last_name ?? "",
    patientName:
      `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim() ||
      "Shopify Customer",
    pan,
    priority: isRush ? PriorityLevel.RUSH : PriorityLevel.NORMAL,
    notes: order.note ?? null,
    shippingAddress,
    items,
  };
}
