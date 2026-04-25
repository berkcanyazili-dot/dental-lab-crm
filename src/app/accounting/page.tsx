"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Loader2,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface AccountingExport {
  id: string;
  type: "INVOICES" | "PAYMENTS" | "CUSTOMERS";
  startDate: string | null;
  endDate: string | null;
  fileName: string;
  rowCount: number;
  totalAmount: number | string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTotal: number;
  balance: number;
  status: string;
  case: { caseNumber: string; patientName: string };
  payments: Array<{ id: string; amount: number; dateApplied: string; paymentType: string }>;
}

const EXPORT_TYPES = [
  { value: "INVOICES", label: "Invoices", icon: ReceiptText },
  { value: "PAYMENTS", label: "Payments", icon: BadgeDollarSign },
  { value: "CUSTOMERS", label: "Customers", icon: Building2 },
] as const;

function firstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountingPage() {
  const [exportType, setExportType] = useState<"INVOICES" | "PAYMENTS" | "CUSTOMERS">("INVOICES");
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [exports, setExports] = useState<AccountingExport[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    const [exportsResponse, invoicesResponse] = await Promise.all([
      fetch("/api/accounting/exports"),
      fetch("/api/invoices"),
    ]);
    const [exportsData, invoicesData] = await Promise.all([
      exportsResponse.json(),
      invoicesResponse.json(),
    ]);
    setExports(Array.isArray(exportsData) ? exportsData : []);
    setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const openInvoices = invoices.filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID");
    const payments = invoices.flatMap((invoice) => invoice.payments);
    return {
      invoiceTotal: invoices.reduce((sum, invoice) => sum + Number(invoice.invoiceTotal), 0),
      openBalance: openInvoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0),
      paymentTotal: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      paymentCount: payments.length,
    };
  }, [invoices]);

  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ type: exportType });
      if (exportType !== "CUSTOMERS") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }
      const response = await fetch(`/api/accounting/exports?${params.toString()}`, {
        method: "POST",
      });
      const blob = await response.blob();
      const fileName =
        response.headers.get("X-Export-File-Name") ??
        `dental-lab-${exportType.toLowerCase()}-${Date.now()}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      await load();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounting Center</h1>
          <p className="mt-1 text-sm text-gray-400">Export invoices, payments, and customer records for QuickBooks, Xero, or accountant review.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex h-9 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm text-gray-300 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invoice Volume</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(totals.invoiceTotal)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Open Balance</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{formatCurrency(totals.openBalance)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payments</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{formatCurrency(totals.paymentTotal)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Count</p>
          <p className="mt-2 text-3xl font-bold text-white">{totals.paymentCount}</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <FileSpreadsheet className="h-4 w-4 text-sky-400" />
            <h2 className="font-semibold text-white">Create Export</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-2">
              {EXPORT_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExportType(value)}
                  className={`flex h-20 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${
                    exportType === value
                      ? "border-sky-400 bg-sky-600 text-white"
                      : "border-gray-800 bg-gray-900 text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>

            {exportType !== "CUSTOMERS" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV
            </button>

            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-xs text-gray-400">
              <p className="font-semibold uppercase tracking-wide text-gray-300">Export format</p>
              <p className="mt-1">CSV files include stable invoice numbers, case numbers, customer names, dates, totals, balances, and payment references.</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ArrowDownToLine className="h-4 w-4 text-sky-400" />
            <h2 className="font-semibold text-white">Recent Accounting Exports</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading exports...</div>
          ) : exports.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No exports created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/60 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Range</th>
                    <th className="px-4 py-3 text-right font-semibold">Rows</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {exports.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-900/60">
                      <td className="px-4 py-3 font-medium text-white">{item.type}</td>
                      <td className="px-4 py-3 text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {item.startDate || item.endDate
                            ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                            : "All records"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{item.rowCount}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(Number(item.totalAmount))}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
