"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Wifi,
  WifiOff,
  Info,
  Copy,
  Check,
} from "lucide-react";

interface Settings {
  storeUrl: string;
  hasToken: boolean;
  hasWebhookSecret: boolean;
  defaultAccountId: string;
  configured: boolean;
}

interface Account {
  id: string;
  name: string;
  doctorName: string | null;
}

export default function ShopifySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [storeUrl, setStoreUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");

  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/shopify").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([s, a]) => {
      setSettings(s);
      setStoreUrl(s.storeUrl ?? "");
      setDefaultAccountId(s.defaultAccountId ?? "");
      setAccounts(Array.isArray(a) ? a : []);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      await fetch("/api/settings/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl: storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          adminToken: adminToken || undefined,
          webhookSecret: webhookSecret || undefined,
          defaultAccountId,
        }),
      });
      const updated = await fetch("/api/settings/shopify").then((r) => r.json());
      setSettings(updated);
      setAdminToken("");
      setWebhookSecret("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, message: `Connected to "${data.shop?.name}" (${data.shop?.domain})` });
      } else {
        setTestResult({ ok: false, message: data.error ?? "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/shopify/webhook`
      : "/api/shopify/webhook";

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-600/20 border border-green-600/30 flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Shopify Integration</h1>
          <p className="text-sm text-gray-400">Connect your Shopify store to auto-import orders as lab cases</p>
        </div>
        <div className="ml-auto">
          {settings?.configured ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
              <Wifi className="w-3.5 h-3.5" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full">
              <WifiOff className="w-3.5 h-3.5" /> Not configured
            </span>
          )}
        </div>
      </div>

      {/* Credentials card */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">API Credentials</h2>

        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
            Shopify Store URL
          </label>
          <input
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="yourstore.myshopify.com"
            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <p className="text-xs text-gray-600 mt-1">Without https:// — e.g. <span className="text-gray-500">yourstore.myshopify.com</span></p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
            Admin API Token {settings?.hasToken && <span className="text-green-400 normal-case font-normal">(saved)</span>}
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder={settings?.hasToken ? "••••••••••••••••••••••••• (leave blank to keep)" : "shpat_..."}
              className="w-full px-3 py-2.5 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Create a Custom App in your Shopify admin with <span className="text-gray-500">read_orders</span> and <span className="text-gray-500">write_fulfillments</span> scopes</p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
            Webhook Secret {settings?.hasWebhookSecret && <span className="text-green-400 normal-case font-normal">(saved)</span>}
          </label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={settings?.hasWebhookSecret ? "•••••••••••••••••••• (leave blank to keep)" : "Optional — from Shopify webhook settings"}
              className="w-full px-3 py-2.5 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saved ? "Saved!" : "Save Credentials"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !settings?.configured}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            Test Connection
          </button>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 text-sm px-4 py-3 rounded-lg border ${
              testResult.ok
                ? "bg-green-900/20 border-green-700/30 text-green-400"
                : "bg-red-900/20 border-red-700/30 text-red-400"
            }`}
          >
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Auto-import settings */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Auto-Import</h2>
          <p className="text-xs text-gray-500 mt-0.5">When a webhook order arrives, automatically create a case under this account</p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
            Default Dental Account
          </label>
          <select
            value={defaultAccountId}
            onChange={(e) => setDefaultAccountId(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
          >
            <option value="">— Manual review only (queue in Incoming) —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.doctorName ? ` — Dr. ${a.doctorName}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-600 mt-1">
            Leave blank to require manual approval in the Incoming queue
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>

      {/* Webhook setup */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Webhook Setup</h2>
          <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">Recommended</span>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
            Webhook Endpoint URL
          </label>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-green-400 font-mono break-all">
              {webhookUrl}
            </code>
            <button
              onClick={copyWebhookUrl}
              className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex-shrink-0"
              title="Copy URL"
            >
              {copiedWebhook ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-700/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5" /> Setup Instructions
          </div>
          <ol className="text-xs text-gray-400 space-y-1.5 pl-4 list-decimal">
            <li>In your Shopify admin, go to <span className="text-gray-200">Settings → Notifications → Webhooks</span></li>
            <li>Click <span className="text-gray-200">Create webhook</span></li>
            <li>Set Event to <span className="text-gray-200">Order creation</span></li>
            <li>Paste the endpoint URL above into the URL field</li>
            <li>Set Format to <span className="text-gray-200">JSON</span></li>
            <li>Copy the <span className="text-gray-200">Signing secret</span> Shopify shows you and paste it above</li>
            <li>Click Save — new orders will now create cases automatically</li>
          </ol>
        </div>
      </div>

      {/* Tag conventions */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Order Tag Conventions</h2>
        <p className="text-xs text-gray-500">Add these tags to Shopify orders to automatically set case fields:</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { tag: "rush", effect: "Sets case priority to RUSH" },
            { tag: "emergency", effect: "Sets case priority to RUSH" },
            { tag: "pan-14", effect: "Sets pan number to 14" },
            { tag: "pan-7", effect: "Sets pan number to 7" },
          ].map(({ tag, effect }) => (
            <div key={tag} className="flex items-center gap-3 bg-gray-900/40 rounded-lg px-3 py-2">
              <code className="text-xs text-yellow-400 font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded">
                {tag}
              </code>
              <span className="text-xs text-gray-400">{effect}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
