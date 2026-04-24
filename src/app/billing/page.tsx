"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  CreditCard,
  Building2,
  User,
  Phone,
  Mail,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */
interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  isActive: boolean;
}

interface Payment {
  id: string;
  amount: number;
  dateApplied: string;
  checkNumber: string | null;
  paymentType: string;
  notes: string | null;
  referenceId: string | null;
  accountNumber: string | null;
}

interface Invoice {
  id: string;
  caseId: string;
  invoiceNumber: string;
  invoiceDate: string;
  type: string;
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  remakeTotal: number;
  netTotal: number;
  invoiceTotal: number;
  balance: number;
  status: string;
  notes: string | null;
  case: { caseNumber: string; patientName: string };
  payments: Payment[];
}

interface Summary {
  periodInvoices: number;
  periodPayments: number;
  balance: number;
  aging: {
    current: number;
    d30: number;
    d60: number;
    d90: number;
    d120: number;
    d150: number;
  };
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function monthLabel(date: Date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d) });
  }
  return months;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PARTIAL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PAID:    "bg-green-500/20 text-green-400 border-green-500/30",
  VOID:    "bg-gray-700/60 text-gray-500 border-gray-600",
};

/* ─── Payment Entry Modal ────────────────────────────────────────── */
function PaymentModal({
  invoices,
  onClose,
  onSave,
}: {
  invoices: Invoice[];
  onClose: () => void;
  onSave: (invoiceId: string, data: Record<string, string>) => Promise<void>;
}) {
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [paymentType, setPaymentType] = useState("CHECK");
  const [notes, setNotes] = useState("");
  const [dateApplied, setDateApplied] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (!invoiceId) { setError("Select an invoice."); return; }
    setSaving(true);
    try {
      await onSave(invoiceId, { amount, checkNumber, paymentType, notes, dateApplied });
      onClose();
    } catch {
      setError("Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-sky-400" />
            Record Payment
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Apply to Invoice</label>
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
            >
              {invoices.filter((i) => i.status !== "PAID" && i.status !== "VOID").map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.case.caseNumber} — Balance: {formatCurrency(inv.balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Date Applied</label>
              <input
                type="date"
                value={dateApplied}
                onChange={(e) => setDateApplied(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Payment Type</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="CASH">Cash</option>
                <option value="CHECK">Check</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="ACH">ACH</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Check Number</label>
              <input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function BillingPage() {
  const months = getLast12Months();
  const now = new Date();

  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  // Load accounts
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .finally(() => setLoadingAccounts(false));
  }, []);

  // Load invoices + summary when account/period changes
  const loadInvoices = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoadingInvoices(true);
    const [invRes, sumRes] = await Promise.all([
      fetch(`/api/invoices?accountId=${selectedAccountId}&year=${selectedYear}&month=${selectedMonth}`),
      fetch(`/api/billing/summary?accountId=${selectedAccountId}`),
    ]);
    const [invData, sumData] = await Promise.all([invRes.json(), sumRes.json()]);
    setInvoices(Array.isArray(invData) ? invData : []);
    setSummary(sumData);
    setLoadingInvoices(false);
  }, [selectedAccountId, selectedYear, selectedMonth]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const toggleExpand = (id: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePayment = async (invoiceId: string, data: Record<string, string>) => {
    await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await loadInvoices();
  };

  // Grand totals
  const grandSubTotal = invoices.reduce((s, i) => s + i.subTotal, 0);
  const grandNetTotal = invoices.reduce((s, i) => s + i.netTotal, 0);
  const grandTaxTotal = invoices.reduce((s, i) => s + i.taxTotal, 0);
  const grandInvoiceTotal = invoices.reduce((s, i) => s + i.invoiceTotal, 0);
  const grandBalance = invoices.reduce((s, i) => s + i.balance, 0);
  const grandDiscount = invoices.reduce((s, i) => s + i.discountTotal, 0);
  const grandRemake = invoices.reduce((s, i) => s + i.remakeTotal, 0);

  // All payments flattened
  const allPayments = invoices.flatMap((inv) =>
    inv.payments.map((p) => ({ ...p, invoiceNumber: inv.invoiceNumber, caseNumber: inv.case.caseNumber, invoiceBalance: inv.balance }))
  );

  const agingBuckets = summary?.aging;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      {/* ── Left Sidebar ── */}
      <aside className="w-52 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col overflow-y-auto">
        {/* Period selector */}
        <div className="px-3 pt-4 pb-3 border-b border-gray-800">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            Billing Period
          </p>
          <div className="space-y-0.5">
            {months.map(({ year, month, label }) => (
              <button
                key={`${year}-${month}`}
                onClick={() => { setSelectedYear(year); setSelectedMonth(month); }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedYear === year && selectedMonth === month
                    ? "bg-sky-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Account list */}
        <div className="px-3 pt-3 pb-4 flex-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            Accounts
          </p>
          {loadingAccounts ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedAccountId === acc.id
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <p className="text-sm font-medium leading-tight truncate">{acc.name}</p>
                  {acc.doctorName && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">Dr. {acc.doctorName}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedAccount ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Building2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Select an account to view billing</p>
            </div>
          </div>
        ) : (
          <>
            {/* Account header */}
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
              <div className="flex items-start gap-6">
                {/* Customer Information */}
                <div className="flex-1">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Customer Information
                  </h2>
                  <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      <span className="text-white font-semibold text-sm">{selectedAccount.name}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${selectedAccount.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {selectedAccount.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {selectedAccount.doctorName && (
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        Dr. {selectedAccount.doctorName}
                      </div>
                    )}
                    {selectedAccount.address && (
                      <p className="text-xs text-gray-500 pl-5">
                        {[selectedAccount.address, selectedAccount.city, selectedAccount.state, selectedAccount.zip].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <div className="flex gap-4 pl-5 text-xs text-gray-500">
                      {selectedAccount.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedAccount.phone}
                        </span>
                      )}
                      {selectedAccount.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedAccount.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Totals */}
                <div className="w-80 flex-shrink-0">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Current Totals
                  </h2>
                  <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pb-2 border-b border-gray-700/50">
                      <span className="text-gray-500">Period Invoices</span>
                      <span className="text-right font-medium text-white">{formatCurrency(summary?.periodInvoices ?? 0)}</span>
                      <span className="text-gray-500">Period Payments</span>
                      <span className="text-right font-medium text-green-400">{formatCurrency(summary?.periodPayments ?? 0)}</span>
                      <span className="text-gray-500 font-semibold">Balance</span>
                      <span className="text-right font-bold text-orange-400">{formatCurrency(summary?.balance ?? 0)}</span>
                    </div>
                    {agingBuckets && (
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        {[
                          { label: "Current", val: agingBuckets.current },
                          { label: "30 days", val: agingBuckets.d30 },
                          { label: "60 days", val: agingBuckets.d60 },
                          { label: "90 days", val: agingBuckets.d90 },
                          { label: "120 days", val: agingBuckets.d120 },
                          { label: "150+ days", val: agingBuckets.d150 },
                        ].map(({ label, val }) => (
                          <div key={label} className={`rounded-lg p-1.5 text-center ${val > 0 ? "bg-gray-700/60" : "bg-gray-800/40"}`}>
                            <p className="text-gray-500 leading-tight">{label}</p>
                            <p className={`font-semibold mt-0.5 ${val > 0 ? "text-white" : "text-gray-600"}`}>{formatCurrency(val)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Entry button */}
                <div className="flex-shrink-0 pt-6">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Payment Entry
                  </button>
                </div>
              </div>
            </div>

            {/* Invoices grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loadingInvoices ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
                </div>
              ) : (
                <>
                  <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-700/50 bg-gray-900/40">
                            <th className="w-8 px-2 py-2.5" />
                            {[
                              "Case #", "Invoice #", "Type", "Sub Total", "Patient",
                              "Net Total", "Tax Total", "Invoice Total", "Balance",
                              "Invoice Date", "Discount", "Remake", "Status",
                            ].map((h) => (
                              <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/30">
                          {invoices.length === 0 ? (
                            <tr>
                              <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                                No invoices for this period
                              </td>
                            </tr>
                          ) : (
                            <>
                              {invoices.map((inv) => (
                                <>
                                  <tr
                                    key={inv.id}
                                    className="hover:bg-gray-700/20 transition-colors cursor-pointer"
                                    onClick={() => toggleExpand(inv.id)}
                                  >
                                    <td className="px-2 py-2.5 text-gray-500">
                                      {expandedInvoices.has(inv.id)
                                        ? <ChevronDown className="w-3.5 h-3.5" />
                                        : <ChevronRight className="w-3.5 h-3.5" />}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-sky-400 whitespace-nowrap">{inv.case.caseNumber}</td>
                                    <td className="px-3 py-2.5 font-mono text-gray-300 whitespace-nowrap">{inv.invoiceNumber}</td>
                                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{inv.type}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{formatCurrency(inv.subTotal)}</td>
                                    <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap max-w-[120px] truncate">{inv.case.patientName}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{formatCurrency(inv.netTotal)}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{formatCurrency(inv.taxTotal)}</td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-white whitespace-nowrap">{formatCurrency(inv.invoiceTotal)}</td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-orange-400 whitespace-nowrap">{formatCurrency(inv.balance)}</td>
                                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-400 whitespace-nowrap">{formatCurrency(inv.discountTotal)}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-400 whitespace-nowrap">{formatCurrency(inv.remakeTotal)}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded-full border font-medium text-[10px] ${STATUS_STYLES[inv.status] ?? ""}`}>
                                        {inv.status}
                                      </span>
                                    </td>
                                  </tr>
                                  {expandedInvoices.has(inv.id) && (
                                    <tr key={`${inv.id}-payments`} className="bg-gray-900/60">
                                      <td colSpan={14} className="px-8 py-3">
                                        {inv.payments.length === 0 ? (
                                          <p className="text-xs text-gray-600 italic">No payments applied to this invoice.</p>
                                        ) : (
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="text-gray-500">
                                                <th className="text-left pb-1.5 pr-6 font-medium">Payment Amount</th>
                                                <th className="text-left pb-1.5 pr-6 font-medium">Date Applied</th>
                                                <th className="text-left pb-1.5 pr-6 font-medium">Check Number</th>
                                                <th className="text-left pb-1.5 pr-6 font-medium">Payment ID</th>
                                                <th className="text-left pb-1.5 font-medium">Acct #</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800/60">
                                              {inv.payments.map((p) => (
                                                <tr key={p.id}>
                                                  <td className="py-1.5 pr-6 text-green-400 font-medium">{formatCurrency(p.amount)}</td>
                                                  <td className="py-1.5 pr-6 text-gray-400">{formatDate(p.dateApplied)}</td>
                                                  <td className="py-1.5 pr-6 text-gray-400">{p.checkNumber ?? "—"}</td>
                                                  <td className="py-1.5 pr-6 font-mono text-gray-500 text-[10px]">{p.id.slice(-8)}</td>
                                                  <td className="py-1.5 text-gray-400">{p.accountNumber ?? "—"}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              ))}
                              {/* Grand totals row */}
                              <tr className="bg-gray-800 border-t-2 border-gray-600 font-semibold">
                                <td className="px-2 py-2.5" />
                                <td className="px-3 py-2.5 text-xs text-gray-400 uppercase tracking-wider" colSpan={3}>Grand Total</td>
                                <td className="px-3 py-2.5 text-right text-white">{formatCurrency(grandSubTotal)}</td>
                                <td className="px-3 py-2.5" />
                                <td className="px-3 py-2.5 text-right text-white">{formatCurrency(grandNetTotal)}</td>
                                <td className="px-3 py-2.5 text-right text-white">{formatCurrency(grandTaxTotal)}</td>
                                <td className="px-3 py-2.5 text-right text-white">{formatCurrency(grandInvoiceTotal)}</td>
                                <td className="px-3 py-2.5 text-right text-orange-400">{formatCurrency(grandBalance)}</td>
                                <td className="px-3 py-2.5" />
                                <td className="px-3 py-2.5 text-right text-white">{formatCurrency(grandDiscount)}</td>
                                <td className="px-3 py-2.5 text-right text-white">{formatCurrency(grandRemake)}</td>
                                <td className="px-3 py-2.5" />
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bottom payments table */}
                  {allPayments.length > 0 && (
                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-700/50">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          All Payments — {monthLabel(new Date(selectedYear, selectedMonth))}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-700/30 bg-gray-900/40">
                              {["Invoice", "Pay ID", "Date Paid", "Amount", "Balance", "Check #", "Type", "Notes"].map((h) => (
                                <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/20">
                            {allPayments.map((p) => (
                              <tr key={p.id} className="hover:bg-gray-700/10 transition-colors">
                                <td className="px-4 py-2.5 font-mono text-gray-400">{p.invoiceNumber}</td>
                                <td className="px-4 py-2.5 font-mono text-gray-500">{p.id.slice(-8)}</td>
                                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(p.dateApplied)}</td>
                                <td className="px-4 py-2.5 font-medium text-green-400">{formatCurrency(p.amount)}</td>
                                <td className="px-4 py-2.5 text-orange-400">{formatCurrency(p.invoiceBalance)}</td>
                                <td className="px-4 py-2.5 text-gray-400">{p.checkNumber ?? "—"}</td>
                                <td className="px-4 py-2.5 text-gray-400">{p.paymentType.replace("_", " ")}</td>
                                <td className="px-4 py-2.5 text-gray-500 max-w-[160px] truncate">{p.notes ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Payment Entry Modal */}
      {showPaymentModal && (
        <PaymentModal
          invoices={invoices}
          onClose={() => setShowPaymentModal(false)}
          onSave={handlePayment}
        />
      )}
    </div>
  );
}
