"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  LogOut,
  PackagePlus,
  Search,
  Truck,
} from "lucide-react";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface PortalAccount {
  name: string;
  doctorName: string | null;
  _count: { cases: number };
  user: { name?: string | null; email?: string | null };
}

interface PortalCase {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  priority: string;
  caseType: string;
  pan: string | null;
  shade: string | null;
  receivedDate: string;
  dueDate: string | null;
  shippedDate: string | null;
  totalValue: string | number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceTotal: string | number;
    balance: string | number;
    status: string;
  }>;
  items: Array<{ id: string; productType: string; toothNumbers: string | null; units: number; shade: string | null }>;
  schedule: Array<{ id: string; department: string; sortOrder: number; status: string; completedDate: string | null }>;
}

const TRACKING_STEPS = ["INCOMING", "IN_LAB", "WIP", "COMPLETE", "SHIPPED"];

function activeStep(status: string) {
  if (status === "HOLD" || status === "REMAKE") return 2;
  const index = TRACKING_STEPS.indexOf(status);
  return index >= 0 ? index : 0;
}

export default function DoctorPortalPage() {
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [cases, setCases] = useState<PortalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [payingInvoiceId, setPayingInvoiceId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/account").then((response) => response.json()),
      fetch("/api/portal/cases").then((response) => response.json()),
    ])
      .then(([accountData, caseData]) => {
        setAccount(accountData);
        setCases(Array.isArray(caseData) ? caseData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter(
      (caseItem) =>
        caseItem.caseNumber.toLowerCase().includes(query) ||
        caseItem.patientName.toLowerCase().includes(query) ||
        (caseItem.pan ?? "").toLowerCase().includes(query)
    );
  }, [cases, search]);

  const counts = {
    active: cases.filter((caseItem) => !["COMPLETE", "SHIPPED"].includes(caseItem.status)).length,
    dueSoon: cases.filter((caseItem) => {
      if (!caseItem.dueDate) return false;
      const due = new Date(caseItem.dueDate).getTime();
      return due <= Date.now() + 3 * 24 * 60 * 60 * 1000 && !["COMPLETE", "SHIPPED"].includes(caseItem.status);
    }).length,
    shipped: cases.filter((caseItem) => caseItem.status === "SHIPPED").length,
  };

  async function handlePayNow(invoiceId: string) {
    setPayingInvoiceId(invoiceId);
    try {
      const response = await fetch(`/api/portal/invoices/${invoiceId}/checkout`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data?.error ?? "Checkout could not be started.");
      }

      window.location.href = data.url;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Checkout could not be started.");
      setPayingInvoiceId("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Doctor Portal</p>
            <h1 className="text-xl font-bold text-white">{account?.name ?? "Dental Lab Portal"}</h1>
            <p className="text-sm text-slate-400">
              {account?.doctorName ? `Dr. ${account.doctorName}` : account?.user.email ?? ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/portal/new-order"
              className="flex h-10 items-center gap-2 rounded bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500"
            >
              <PackagePlus className="h-4 w-4" />
              Submit Order
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-10 items-center gap-2 rounded border border-slate-700 px-3 text-sm text-slate-300 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-6">
        <section className="grid gap-3 md:grid-cols-4">
          <div className="border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Cases</p>
            <p className="mt-2 text-3xl font-bold text-white">{account?._count.cases ?? cases.length}</p>
          </div>
          <div className="border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.active}</p>
          </div>
          <div className="border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due Soon</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{counts.dueSoon}</p>
          </div>
          <div className="border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipped</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{counts.shipped}</p>
          </div>
        </section>

        <section className="border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-white">Cases</h2>
              <p className="text-sm text-slate-400">Track submitted lab orders and delivery status.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search case, patient, pan"
                className="h-9 w-full rounded border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading cases...</div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No cases found.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredCases.map((caseItem) => {
                const step = activeStep(caseItem.status);
                const openInvoice = caseItem.invoices.find((invoice) => Number(invoice.balance) > 0);
                return (
                  <article key={caseItem.id} className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white">{caseItem.caseNumber}</span>
                          <span className="text-slate-500">/</span>
                          <span className="font-medium text-slate-100">{caseItem.patientName}</span>
                          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_COLORS[caseItem.status])}>
                            {caseItem.status.replace("_", " ")}
                          </span>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY_COLORS[caseItem.priority])}>
                            {caseItem.priority}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {caseItem.items.map((item) => item.productType).join(", ") || caseItem.caseType}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(caseItem.dueDate)}</span>
                          <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {caseItem.shippedDate ? `Shipped ${formatDate(caseItem.shippedDate)}` : "Not shipped"}</span>
                          <span>{formatCurrency(Number(caseItem.totalValue))}</span>
                        </div>
                      </div>
                      {openInvoice && (
                        <div className="flex min-w-[220px] flex-col items-start gap-2 rounded border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Outstanding Invoice
                          </p>
                          <div className="text-sm text-slate-300">
                            <p className="font-semibold text-white">{openInvoice.invoiceNumber}</p>
                            <p>Balance {formatCurrency(Number(openInvoice.balance))}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePayNow(openInvoice.id)}
                            disabled={payingInvoiceId === openInvoice.id}
                            className="flex h-9 items-center gap-2 rounded bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            <CreditCard className="h-4 w-4" />
                            {payingInvoiceId === openInvoice.id ? "Opening..." : "Pay Now"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {TRACKING_STEPS.map((label, index) => (
                        <div key={label} className="min-w-0">
                          <div className={cn("h-1.5", index <= step ? "bg-sky-500" : "bg-slate-800")} />
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {index <= step ? <CheckCircle2 className="h-3 w-3 text-sky-300" /> : <Clock3 className="h-3 w-3" />}
                            <span className="truncate">{label.replace("_", " ")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
