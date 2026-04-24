"use client";

import { useState } from "react";
import Link from "next/link";
import { FileBarChart, Play, Printer, RefreshCw, Search, ExternalLink } from "lucide-react";

/* ─── Report definitions ─────────────────────────────────────── */
interface ReportDef {
  id: string;
  label: string;
  description: string;
  usesDateRange: boolean;
  special?: "work-ticket";
}

const REPORTS: ReportDef[] = [
  { id: "daily-invoice-payment", label: "Daily Invoice & Payment", description: "Invoices and payments received in the period", usesDateRange: true },
  { id: "daily-totals", label: "Daily Totals", description: "Case counts and values by day", usesDateRange: true },
  { id: "doctor-monthly-sales", label: "Doctor Monthly Sales", description: "Invoice totals per doctor grouped by month", usesDateRange: true },
  { id: "doctors-without-cases", label: "Doctors Without Cases", description: "Accounts with no cases received in the period", usesDateRange: true },
  { id: "invoice-register", label: "Invoice Register by Doctor", description: "All invoices grouped by doctor", usesDateRange: true },
  { id: "outstanding-invoices", label: "Outstanding Invoices", description: "Unpaid and partially-paid invoices", usesDateRange: false },
  { id: "payment-register", label: "Payment Register", description: "All payments applied in the period", usesDateRange: true },
  { id: "product-sales", label: "Product Sales Analysis", description: "Revenue and volume by product type", usesDateRange: true },
  { id: "product-sales-remakes", label: "Product Sales and Remakes", description: "Sales vs. remakes per product", usesDateRange: true },
  { id: "scheduled-cases-by-step", label: "Scheduled Cases by Step", description: "All department schedule entries", usesDateRange: false },
  { id: "tech-productivity", label: "Tech Productivity Analysis", description: "Cases, units, and value per technician", usesDateRange: true },
  { id: "value-of-wip", label: "Value of WIP", description: "Dollar value of all in-lab and WIP cases", usesDateRange: false },
  { id: "work-ticket", label: "Work Ticket", description: "Print a work ticket for a specific case", usesDateRange: false, special: "work-ticket" },
];

/* ─── Types ──────────────────────────────────────────────────── */
interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  type?: "currency" | "date" | "number" | "text";
}

interface ReportResult {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number>;
}

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtValue(val: string | number | null, type?: string) {
  if (val === null || val === undefined) return "—";
  if (type === "currency" && typeof val === "number") return fmtCurrency(val);
  if (type === "number" && typeof val === "number") return val.toLocaleString();
  return String(val);
}

function defaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function ReportsPage() {
  const [selected, setSelected] = useState<ReportDef>(REPORTS[0]);
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Work ticket special state
  const [wtQuery, setWtQuery] = useState("");
  const [wtCaseId, setWtCaseId] = useState<string | null>(null);
  const [wtSearching, setWtSearching] = useState(false);
  const [wtError, setWtError] = useState<string | null>(null);

  const runReport = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selected.id, from, to }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const findWorkTicketCase = async () => {
    if (!wtQuery.trim()) return;
    setWtSearching(true);
    setWtError(null);
    setWtCaseId(null);
    const res = await fetch(`/api/cases?caseNumber=${encodeURIComponent(wtQuery.trim().toUpperCase())}`);
    const data = await res.json();
    setWtSearching(false);
    if (!Array.isArray(data) || data.length === 0) {
      setWtError(`No case found matching "${wtQuery.trim()}"`);
      return;
    }
    setWtCaseId(data[0].id);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Report list sidebar ── */}
      <aside className="w-56 flex-shrink-0 bg-gray-950 border-r border-gray-800 overflow-y-auto py-4">
        <p className="px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Available Reports
        </p>
        <div className="space-y-0.5 px-2">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelected(r); setResult(null); setError(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors leading-snug ${
                selected.id === r.id
                  ? "bg-sky-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Controls header */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <FileBarChart className="w-4 h-4 text-sky-400" />
                <h1 className="text-base font-bold text-white">{selected.label}</h1>
              </div>
              <p className="text-xs text-gray-500">{selected.description}</p>
            </div>

            <div className="flex items-center gap-3">
              {selected.usesDateRange && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 font-medium">From</label>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 font-medium">To</label>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </>
              )}

              {!selected.special && (
                <button
                  onClick={runReport}
                  disabled={running}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Report
                </button>
              )}

              {result && (
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors no-print"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">
          {/* Work ticket special UI */}
          {selected.special === "work-ticket" && (
            <div className="p-6 max-w-md space-y-4">
              <p className="text-sm text-gray-400">
                Enter a case number to open its printable work ticket in a new tab.
              </p>
              <div className="flex gap-3">
                <input
                  value={wtQuery}
                  onChange={(e) => setWtQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && findWorkTicketCase()}
                  placeholder="Case number (e.g. DL-00001)"
                  className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  onClick={findWorkTicketCase}
                  disabled={wtSearching || !wtQuery.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {wtSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Find
                </button>
              </div>
              {wtError && <p className="text-sm text-red-400">{wtError}</p>}
              {wtCaseId && (
                <Link
                  href={`/cases/${wtCaseId}/workticket`}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Work Ticket
                </Link>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="m-6 text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Running spinner */}
          {running && (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          )}

          {/* Results table */}
          {result && !running && (
            <div className="p-6">
              {/* Print header (shown only when printing) */}
              <div className="hidden print:block mb-6">
                <h1 className="text-xl font-bold">{result.title}</h1>
                {result.subtitle && <p className="text-sm text-gray-600 mt-0.5">{result.subtitle}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  Dental Lab CRM — Printed {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>

              {/* Screen header */}
              <div className="flex items-center justify-between mb-4 print:hidden">
                <div>
                  <h2 className="text-base font-bold text-white">{result.title}</h2>
                  {result.subtitle && <p className="text-xs text-gray-500 mt-0.5">{result.subtitle}</p>}
                </div>
                <span className="text-xs text-gray-500">{result.rows.length} row{result.rows.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden print:border print:border-gray-300 print:rounded-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700/50 bg-gray-900/40 print:bg-gray-100 print:border-gray-300">
                        {result.columns.map((col) => (
                          <th
                            key={col.key}
                            className={`px-4 py-2.5 font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap print:text-gray-700 ${
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/30 print:divide-gray-200">
                      {result.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={result.columns.length}
                            className="px-4 py-10 text-center text-gray-500"
                          >
                            No data for this period
                          </td>
                        </tr>
                      ) : (
                        result.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-700/20 transition-colors print:hover:bg-transparent">
                            {result.columns.map((col) => (
                              <td
                                key={col.key}
                                className={`px-4 py-2.5 text-gray-300 whitespace-nowrap print:text-gray-800 ${
                                  col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : ""
                                } ${col.type === "currency" ? "font-medium" : ""}`}
                              >
                                {fmtValue(row[col.key], col.type)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>

                    {/* Totals row */}
                    {result.totals && result.rows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-600 bg-gray-800 font-semibold print:bg-gray-100 print:border-gray-400">
                          {result.columns.map((col, i) => (
                            <td
                              key={col.key}
                              className={`px-4 py-2.5 text-white print:text-gray-900 ${
                                col.align === "right" ? "text-right tabular-nums" : ""
                              }`}
                            >
                              {i === 0
                                ? "Totals"
                                : result.totals![col.key] !== undefined
                                ? fmtValue(result.totals![col.key], col.type)
                                : ""}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no report run yet */}
          {!result && !running && !error && !selected.special && (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-600">
              <FileBarChart className="w-10 h-10 mb-3" />
              <p className="text-sm">Configure the date range above and click Run Report</p>
            </div>
          )}
        </div>
      </div>

      {/* Global print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
