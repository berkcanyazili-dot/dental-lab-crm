"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  LogOut,
  Package,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  StickyNote,
  UserRound,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface CaseItem {
  id: string;
  productType: string;
  toothNumbers: string | null;
  units: number;
  shade: string | null;
  material: string | null;
}

interface ScheduleStep {
  id: string;
  department: string;
  sortOrder: number;
  status: "SCHEDULED" | "READY" | "IN_PROCESS" | "COMPLETE";
  technicianId: string | null;
  completedDate: string | null;
  technician: { id: string; name: string } | null;
}

interface TechCase {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  priority: string;
  dueDate: string | null;
  pan: string | null;
  shade: string | null;
  internalNotes: string | null;
  dentalAccount: { name: string; doctorName: string | null };
  items: CaseItem[];
  schedule: ScheduleStep[];
}

interface Technician {
  id: string;
  name: string;
  specialty: string | null;
}

type Filter = "MY_WORK" | "READY" | "IN_PROCESS" | "RUSH";

function isLate(value: string | null) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

function actionableStep(caseItem: TechCase, technicianId: string) {
  return (
    caseItem.schedule.find((step) => step.status === "IN_PROCESS" && step.technicianId === technicianId) ??
    caseItem.schedule.find((step) => step.status === "READY" && (!step.technicianId || step.technicianId === technicianId)) ??
    caseItem.schedule.find((step) => step.status === "SCHEDULED" && (!step.technicianId || step.technicianId === technicianId)) ??
    null
  );
}

function totalUnits(caseItem: TechCase) {
  return caseItem.items.reduce((sum, item) => sum + item.units, 0);
}

export default function TechnicianMobilePage() {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [cases, setCases] = useState<TechCase[]>([]);
  const [filter, setFilter] = useState<Filter>("MY_WORK");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tech/work");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load work");
      setTechnician(data.technician);
      setCases(Array.isArray(data.cases) ? data.cases : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredCases = useMemo(() => {
    if (!technician) return [];
    return cases
      .filter((caseItem) => {
        const step = actionableStep(caseItem, technician.id);
        if (!step) return false;
        if (filter === "IN_PROCESS") return step.status === "IN_PROCESS";
        if (filter === "READY") return step.status === "READY" || step.status === "SCHEDULED";
        if (filter === "RUSH") return caseItem.priority === "RUSH" || caseItem.priority === "STAT";
        return step.technicianId === technician.id || !step.technicianId;
      })
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { STAT: 0, RUSH: 1, NORMAL: 2 };
        const priority = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (priority !== 0) return priority;
        return new Date(a.dueDate ?? "2999-12-31").getTime() - new Date(b.dueDate ?? "2999-12-31").getTime();
      });
  }, [cases, filter, technician]);

  const counts = useMemo(() => {
    if (!technician) return { ready: 0, inProcess: 0, rush: 0 };
    return cases.reduce(
      (acc, caseItem) => {
        const step = actionableStep(caseItem, technician.id);
        if (step?.status === "IN_PROCESS") acc.inProcess += 1;
        if (step?.status === "READY" || step?.status === "SCHEDULED") acc.ready += 1;
        if (caseItem.priority === "RUSH" || caseItem.priority === "STAT") acc.rush += 1;
        return acc;
      },
      { ready: 0, inProcess: 0, rush: 0 }
    );
  }, [cases, technician]);

  async function act(caseItem: TechCase, action: "START_STEP" | "COMPLETE_STEP" | "RELEASE_STEP") {
    if (!technician) return;
    const step = actionableStep(caseItem, technician.id);
    if (!step) return;

    setActingId(`${caseItem.id}-${action}`);
    setError("");
    try {
      const response = await fetch("/api/tech/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, caseId: caseItem.id, scheduleId: step.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Action failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">{technician?.name ?? "Technician"}</h1>
            <p className="truncate text-xs text-slate-400">{technician?.specialty ?? "Mobile Workspace"}</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-300"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="px-4 pb-24 pt-4">
        <section className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Ready</p>
            <p className="mt-1 text-2xl font-bold">{counts.ready}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-1 text-2xl font-bold text-sky-300">{counts.inProcess}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Rush</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{counts.rush}</p>
          </div>
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {[
            ["MY_WORK", "My Work"],
            ["READY", "Ready"],
            ["IN_PROCESS", "Started"],
            ["RUSH", "Rush"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as Filter)}
              className={cn(
                "h-9 flex-shrink-0 rounded-full px-4 text-sm font-semibold",
                filter === key ? "bg-sky-600 text-white" : "bg-slate-900 text-slate-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-700 bg-red-950 p-3 text-sm text-red-100">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-56 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading work...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center text-sm text-slate-500">
            <CheckCircle2 className="mb-2 h-8 w-8" />
            No work in this queue
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCases.map((caseItem) => {
              const step = technician ? actionableStep(caseItem, technician.id) : null;
              const late = isLate(caseItem.dueDate);
              const inProcess = step?.status === "IN_PROCESS";
              return (
                <article key={caseItem.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-300">{caseItem.caseNumber}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", caseItem.priority === "STAT" || caseItem.priority === "RUSH" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-300")}>
                          {caseItem.priority}
                        </span>
                        {late && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300">LATE</span>}
                      </div>
                      <h2 className="mt-1 truncate text-lg font-bold">{caseItem.patientName}</h2>
                      <p className="truncate text-sm text-slate-400">
                        {caseItem.dentalAccount.name}
                        {caseItem.dentalAccount.doctorName ? ` / Dr. ${caseItem.dentalAccount.doctorName}` : ""}
                      </p>
                    </div>
                    {caseItem.pan && (
                      <div className="rounded-xl bg-slate-950 px-3 py-2 text-center">
                        <p className="text-[10px] uppercase text-slate-500">Pan</p>
                        <p className="text-xl font-black">{caseItem.pan}</p>
                      </div>
                    )}
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Step</p>
                      <p className="mt-1 font-semibold">{step?.department ?? "No step"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Due</p>
                      <p className={cn("mt-1 font-semibold", late && "text-red-300")}>{formatDate(caseItem.dueDate)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Units</p>
                      <p className="mt-1 font-semibold">{totalUnits(caseItem)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Shade</p>
                      <p className="mt-1 font-semibold">{caseItem.shade ?? caseItem.items.find((item) => item.shade)?.shade ?? "-"}</p>
                    </div>
                  </div>

                  <div className="mb-3 space-y-1.5">
                    {caseItem.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm text-slate-300">
                        <Package className="h-3.5 w-3.5 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate">{item.productType}</span>
                        <span className="text-slate-500">x{item.units}</span>
                      </div>
                    ))}
                  </div>

                  {caseItem.internalNotes && (
                    <div className="mb-3 flex gap-2 rounded-xl border border-blue-700/40 bg-blue-950/40 p-3 text-sm text-blue-100">
                      <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <p>{caseItem.internalNotes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {inProcess ? (
                      <>
                        <button
                          type="button"
                          onClick={() => act(caseItem, "COMPLETE_STEP")}
                          disabled={actingId !== null}
                          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {actingId === `${caseItem.id}-COMPLETE_STEP` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => act(caseItem, "RELEASE_STEP")}
                          disabled={actingId !== null}
                          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-700 text-sm font-bold text-white disabled:opacity-60"
                        >
                          <PauseCircle className="h-5 w-5" />
                          Release
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => act(caseItem, "START_STEP")}
                        disabled={actingId !== null}
                        className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {actingId === `${caseItem.id}-START_STEP` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
                        Start {step?.department ?? "Work"}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {step?.status.replace("_", " ") ?? "No status"}
                    </span>
                    <span>{caseItem.status.replace("_", " ")}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
