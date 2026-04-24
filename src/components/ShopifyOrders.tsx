"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  X,
  ExternalLink,
  Clock,
  Settings,
  Tag,
  AlertCircle,
} from "lucide-react";

interface ShopifyLineItemSummary {
  title: string;
  quantity: number;
  price: string;
}

interface ShopifyOrderRecord {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  totalPrice: number;
  itemCount: number;
  tags: string | null;
  rawData: string;
  shopifyCreatedAt: string;
  status: string;
  case: { id: string; caseNumber: string } | null;
}

interface Account {
  id: string;
  name: string;
  doctorName: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function getLineItems(rawData: string): ShopifyLineItemSummary[] {
  try {
    const order = JSON.parse(rawData);
    return (order.line_items ?? []).map((li: ShopifyLineItemSummary & { title: string; quantity: number; price: string }) => ({
      title: li.title,
      quantity: li.quantity,
      price: li.price,
    }));
  } catch {
    return [];
  }
}

export default function ShopifyOrders() {
  const [orders, setOrders] = useState<ShopifyOrderRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Per-card accept state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Record<string, string>>({});
  const [accepting, setAccepting] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [createdCase, setCreatedCase] = useState<Record<string, { id: string; caseNumber: string }>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, settingsRes, accountsRes] = await Promise.all([
        fetch("/api/shopify/orders?status=PENDING"),
        fetch("/api/settings/shopify"),
        fetch("/api/accounts"),
      ]);
      const [ordersData, settingsData, accountsData] = await Promise.all([
        ordersRes.json(),
        settingsRes.json(),
        accountsRes.json(),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setConfigured(settingsData.configured ?? false);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(`Fetched ${data.fetched} orders — ${data.imported} new`);
        setLastSynced(new Date());
        await loadOrders();
      }
    } catch {
      setSyncResult("Sync failed — check your connection");
    } finally {
      setSyncing(false);
    }
  };

  const handleAccept = async (order: ShopifyOrderRecord) => {
    const accountId = selectedAccount[order.id];
    if (!accountId) return;
    setAccepting(order.id);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dentalAccountId: accountId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newCase = await res.json();
      setCreatedCase((prev) => ({
        ...prev,
        [order.id]: { id: newCase.id, caseNumber: newCase.caseNumber },
      }));
      setExpandedId(null);
      await loadOrders();
    } catch (e) {
      alert(`Failed to create case: ${e}`);
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!confirm("Reject this order? It will be removed from the queue.")) return;
    setRejecting(orderId);
    try {
      await fetch(`/api/shopify/orders/${orderId}/reject`, { method: "POST" });
      await loadOrders();
    } finally {
      setRejecting(null);
    }
  };

  // Don't render anything if loading and no orders yet (avoid layout flash)
  if (!loading && !configured && orders.length === 0) {
    return (
      <div className="px-6 pt-6">
        <div className="flex items-center gap-3 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-xl text-sm text-yellow-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Shopify integration is not configured.{" "}
            <Link href="/settings/shopify" className="underline hover:text-yellow-300 transition-colors">
              Set up your credentials
            </Link>{" "}
            to import orders from Shopify.
          </span>
        </div>
      </div>
    );
  }

  if (!loading && configured && orders.length === 0) {
    return (
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-white">Shopify Orders</h2>
            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">0 pending</span>
          </div>
          <SyncButton syncing={syncing} onSync={handleSync} lastSynced={lastSynced} />
        </div>
        {syncResult && <SyncResultBanner message={syncResult} />}
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-5 py-8 text-center text-sm text-gray-500">
          No pending Shopify orders.{" "}
          <button onClick={handleSync} className="text-sky-400 hover:text-sky-300 transition-colors">
            Sync now
          </button>{" "}
          to check for new orders.
        </div>
        <div className="border-b border-gray-800 mt-6" />
      </div>
    );
  }

  if (loading) return null;

  return (
    <div className="px-6 pt-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-semibold text-white">Shopify Orders</h2>
          <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
            {orders.length} pending
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/shopify"
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3 h-3" />
            Settings
          </Link>
          <SyncButton syncing={syncing} onSync={handleSync} lastSynced={lastSynced} />
        </div>
      </div>

      {syncResult && <SyncResultBanner message={syncResult} />}

      {/* Order cards */}
      <div className="space-y-3 mb-6">
        {orders.map((order) => {
          const lineItems = getLineItems(order.rawData);
          const tags = parseTags(order.tags);
          const isExpanded = expandedId === order.id;
          const done = createdCase[order.id];
          const isRush = tags.some((t) => t.toLowerCase() === "rush" || t.toLowerCase() === "emergency");

          return (
            <div
              key={order.id}
              className={`bg-gray-800/60 border rounded-xl overflow-hidden transition-all ${
                isRush ? "border-yellow-600/40" : "border-gray-700/50"
              }`}
            >
              <div className="px-4 py-3 flex items-start gap-4">
                {/* Order number */}
                <div className="flex-shrink-0">
                  <div className="text-xs text-gray-500 font-medium">Order</div>
                  <div className="text-base font-bold text-white font-mono">
                    #{order.shopifyOrderNumber}
                  </div>
                </div>

                {/* Customer + items */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white truncate">
                      {order.customerName ?? "Unknown Customer"}
                    </span>
                    {isRush && (
                      <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        Rush
                      </span>
                    )}
                  </div>

                  {/* Line items */}
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {lineItems.slice(0, 4).map((li, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700/60 text-gray-300 px-2 py-0.5 rounded"
                      >
                        {li.title} ×{li.quantity}
                      </span>
                    ))}
                    {lineItems.length > 4 && (
                      <span className="text-xs text-gray-500">+{lineItems.length - 4} more</span>
                    )}
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-700/40 px-1.5 py-0.5 rounded"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Meta + actions */}
                <div className="flex-shrink-0 text-right space-y-1">
                  <div className="text-sm font-bold text-green-400">
                    {formatCurrency(order.totalPrice)}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {formatDate(order.shopifyCreatedAt)}
                  </div>

                  {done ? (
                    <div className="flex items-center gap-1 text-xs text-green-400 justify-end">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <Link
                        href={`/cases/${done.id}`}
                        className="hover:underline font-medium"
                      >
                        {done.caseNumber}
                        <ExternalLink className="w-3 h-3 inline ml-0.5" />
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="text-xs px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        disabled={rejecting === order.id}
                        className="text-xs px-2 py-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Reject order"
                      >
                        {rejecting === order.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded: account picker */}
              {isExpanded && !done && (
                <div className="px-4 py-3 bg-gray-900/60 border-t border-gray-700/40 flex items-center gap-3">
                  <label className="text-xs text-gray-400 font-medium whitespace-nowrap">
                    Dental Account:
                  </label>
                  <select
                    value={selectedAccount[order.id] ?? ""}
                    onChange={(e) =>
                      setSelectedAccount((prev) => ({ ...prev, [order.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="">— Select account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.doctorName ? ` — Dr. ${a.doctorName}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAccept(order)}
                    disabled={!selectedAccount[order.id] || accepting === order.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    {accepting === order.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Create Case
                  </button>
                  <button
                    onClick={() => setExpandedId(null)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-b border-gray-800 mb-0" />
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */
function SyncButton({
  syncing,
  onSync,
  lastSynced,
}: {
  syncing: boolean;
  onSync: () => void;
  lastSynced: Date | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {lastSynced && (
        <span className="text-xs text-gray-600">
          Last synced {lastSynced.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      <button
        onClick={onSync}
        disabled={syncing}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}

function SyncResultBanner({ message }: { message: string }) {
  return (
    <div className="mb-3 text-xs text-gray-400 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2">
      {message}
    </div>
  );
}
