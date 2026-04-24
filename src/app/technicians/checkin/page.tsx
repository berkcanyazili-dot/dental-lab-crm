"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle,
  LogOut,
  CheckSquare,
  Square,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock,
  Zap,
  StickyNote,
  User,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface CaseItem {
  id: string;
  productType: string;
  units: number;
  shade: string | null;
}

interface DeptSchedule {
  id: string;
  department: string;
  status: string;
  sortOrder: number;
  technician: { id: string; name: string } | null;
}

interface Case {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  priority: string;
  receivedDate: string;
  dueDate: string | null;
  pan: string | null;
  shade: string | null;
  metalSelection: string | null;
  internalNotes: string | null;
  dentalAccount: { id: string; name: string; doctorName: string | null };
  technician: { id: string; name: string } | null;
  items: CaseItem[];
  schedule: DeptSchedule[];
  _checkedInTech?: { id: string; name: string } | null;
}

interface Technician {
  id: string;
  name: string;
}

type FilterType = "ALL" | "CHECKED_IN" | "RUSH" | "LATE" | "TODAY" | "FUTURE";
type SortKey = "priority" | "shade" | "metal" | "units" | "case" | "pan";

function isLate(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isDueFuture(dueDate: string | null) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  return d > now && d.toDateString() !== now.toDateString();
}

function getStatusDotColor(c: Case): string {
  if (c.internalNotes) return "bg-blue-400";
  if (c.priority === "RUSH" || c.priority === "EMERGENCY") return "bg-yellow-400";
  if (isLate(c.dueDate)) return "bg-orange-400";
  return "bg-green-400";
}

function getActiveStep(c: Case): DeptSchedule | null {
  return (
    c.schedule.find((s) => s.status === "IN_PROCESS") ??
    c.schedule.find((s) => s.status === "READY") ??
    c.schedule.find((s) => s.status === "SCHEDULED") ??
    null
  );
}

function totalUnits(c: Case) {
  return c.items.reduce((s, i) => s + i.units, 0);
}

export default function CheckInPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [casesRes, techsRes] = await Promise.all([
        fetch("/api/cases?status=WIP,IN_LAB"),
        fetch("/api/technicians"),
      ]);
      if (!casesRes.ok || !techsRes.ok) throw new Error("Failed to load data");
      const [casesData, techsData] = await Promise.all([casesRes.json(), techsRes.json()]);

      // For each case, check if a tech is currently checked in via schedule
      const enriched: Case[] = (casesData as Case[]).map((c) => {
        const inProcessStep = c.schedule?.find((s) => s.status === "IN_PROCESS");
        return {
          ...c,
          schedule: c.schedule ?? [],
          _checkedInTech: inProcessStep?.technician ?? null,
        };
      });

      setCases(enriched);
      setTechnicians(techsData);
      if (!selectedTechId && techsData.length > 0) {
        setSelectedTechId(techsData[0].id);
      }
    } catch (e) {
      setError("Failed to load cases. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [selectedTechId]);

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = cases
    .filter((c) => {
      if (filter === "CHECKED_IN") return !!c._checkedInTech;
      if (filter === "RUSH") return c.priority === "RUSH" || c.priority === "EMERGENCY";
      if (filter === "LATE") return isLate(c.dueDate);
      if (filter === "TODAY") return isDueToday(c.dueDate);
      if (filter === "FUTURE") return isDueFuture(c.dueDate);
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "priority") {
        const order = { EMERGENCY: 0, RUSH: 1, NORMAL: 2 };
        return (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2);
      }
      if (sortKey === "shade") return (a.shade ?? "").localeCompare(b.shade ?? "");
      if (sortKey === "metal") return (a.metalSelection ?? "").localeCompare(b.metalSelection ?? "");
      if (sortKey === "units") return totalUnits(b) - totalUnits(a);
      if (sortKey === "case") return a.caseNumber.localeCompare(b.caseNumber);
      if (sortKey === "pan") return (a.pan ?? "").localeCompare(b.pan ?? "");
      return 0;
    });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  const doAction = async (type: "CHECKIN" | "CHECKOUT") => {
    if (!selectedTechId) {
      setError("Select a technician first.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one case.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      await Promise.all(
        Array.from(selected).map((caseId) =>
          fetch("/api/technicians/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ technicianId: selectedTechId, caseId, type }),
          })
        )
      );
      clearSelection();
      await fetchData();
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setActing(false);
    }
  };

  const doRelease = async () => {
    if (selected.size === 0) {
      setError("Select at least one case.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      // Mark the in-process schedule step as READY (release without completing)
      const promises = Array.from(selected).flatMap((caseId) => {
        const c = cases.find((x) => x.id === caseId);
        const step = c?.schedule.find((s) => s.status === "IN_PROCESS");
        if (!step) return [];
        return fetch(`/api/cases/${caseId}/schedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: step.id, status: "READY" }),
        });
      });
      await Promise.all(promises);
      clearSelection();
      await fetchData();
    } catch {
      setError("Release failed. Please try again.");
    } finally {
      setActing(false);
    }
  };

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "ALL", label: "Show All" },
    { key: "CHECKED_IN", label: "Checked In" },
    { key: "RUSH", label: "Rush" },
    { key: "LATE", label: "Late" },
    { key: "TODAY", label: "Due Today" },
    { key: "FUTURE", label: "Future" },
  ];

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "priority", label: "Priority" },
    { key: "shade", label: "Shade" },
    { key: "metal", label: "Metal" },
    { key: "units", label: "Units" },
    { key: "case", label: "Case #" },
    { key: "pan", label: "Pan" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Filter Sidebar */}
      <aside className="w-48 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col pt-4 pb-24">
        <p className="px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Filter
        </p>
        <div className="space-y-0.5 px-2">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-sky-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-4 pt-4">
          <p className="px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Sort By
          </p>
          <div className="space-y-0.5 px-2">
            {sortButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortKey === key
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-white">Tech Check In / Out</h1>
            <p className="text-xs text-gray-500">
              {filtered.length} cases · {selected.size} selected
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
              >
                <option value="">— Select Technician —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 bg-red-900/30 border border-red-700/50 text-red-400 text-sm px-4 py-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-6 pb-24">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading cases…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              No cases match this filter
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((c) => {
                const isSelected = selected.has(c.id);
                const activeStep = getActiveStep(c);
                const dotColor = getStatusDotColor(c);
                const late = isLate(c.dueDate);
                const today = isDueToday(c.dueDate);
                const checkedIn = !!c._checkedInTech;

                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={`relative bg-gray-800 rounded-xl border-2 cursor-pointer transition-all select-none ${
                      isSelected
                        ? "border-sky-500 shadow-lg shadow-sky-900/30"
                        : "border-gray-700/50 hover:border-gray-600"
                    }`}
                  >
                    {/* Selection indicator */}
                    <div className="absolute top-3 right-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-600" />
                      )}
                    </div>

                    <div className="p-3">
                      {/* Status dot + case number */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
                          title={
                            c.internalNotes
                              ? "Has notes"
                              : c.priority === "RUSH"
                              ? "Rush"
                              : late
                              ? "Overdue"
                              : "Ready"
                          }
                        />
                        <span className="font-mono text-xs text-sky-400 font-medium">
                          {c.caseNumber}
                        </span>
                        {(c.priority === "RUSH" || c.priority === "EMERGENCY") && (
                          <span className="ml-auto">
                            <Zap className="w-3 h-3 text-yellow-400" />
                          </span>
                        )}
                      </div>

                      {/* Pan number - large */}
                      {c.pan && (
                        <div className="text-2xl font-bold text-white leading-none mb-1">
                          {c.pan}
                        </div>
                      )}

                      {/* Patient */}
                      <p className="text-sm font-medium text-white truncate mb-0.5">
                        {c.patientName}
                      </p>
                      <p className="text-xs text-gray-500 truncate mb-2">
                        {c.dentalAccount.name}
                      </p>

                      {/* Products */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.items.slice(0, 2).map((item) => (
                          <span
                            key={item.id}
                            className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded"
                          >
                            {item.productType} ×{item.units}
                          </span>
                        ))}
                        {c.items.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{c.items.length - 2}
                          </span>
                        )}
                      </div>

                      {/* Shade / Metal row */}
                      {(c.shade || c.metalSelection) && (
                        <div className="flex gap-2 text-xs text-gray-400 mb-2">
                          {c.shade && <span>Shade: <span className="text-white">{c.shade}</span></span>}
                          {c.metalSelection && c.metalSelection !== "None" && (
                            <span>Metal: <span className="text-white">{c.metalSelection}</span></span>
                          )}
                        </div>
                      )}

                      {/* Active dept step */}
                      {activeStep && (
                        <div className="text-xs text-gray-500 mb-2">
                          Dept:{" "}
                          <span className="text-gray-300 font-medium">
                            {activeStep.department}
                          </span>
                        </div>
                      )}

                      {/* Notes indicator */}
                      {c.internalNotes && (
                        <div className="flex items-center gap-1 text-xs text-blue-400 mb-2">
                          <StickyNote className="w-3 h-3" />
                          <span>Has notes</span>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-gray-700/50 pt-2 mt-1">
                        <span>Rcv: {formatDate(c.receivedDate)}</span>
                        <span className={late ? "text-red-400 font-medium" : today ? "text-yellow-400" : ""}>
                          {c.dueDate ? (
                            <>
                              {late && <AlertCircle className="w-2.5 h-2.5 inline mr-0.5" />}
                              {today && <Clock className="w-2.5 h-2.5 inline mr-0.5" />}
                              Due: {formatDate(c.dueDate)}
                            </>
                          ) : (
                            "No due date"
                          )}
                        </span>
                      </div>

                      {/* Checked-in indicator */}
                      {checkedIn && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-700/50 text-xs text-green-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                          </span>
                          {c._checkedInTech!.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-gray-950 border-t border-gray-800 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => doAction("CHECKIN")}
          disabled={acting || selected.size === 0 || !selectedTechId}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Check In
        </button>

        <button
          onClick={() => doAction("CHECKOUT")}
          disabled={acting || selected.size === 0 || !selectedTechId}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Check Out
        </button>

        <button
          onClick={doRelease}
          disabled={acting || selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Release
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <button
          onClick={selectAll}
          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <CheckSquare className="w-4 h-4" />
          Select All
        </button>

        <button
          onClick={clearSelection}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white disabled:text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          Clear
        </button>

        {selected.size === 1 && (
          <>
            <div className="w-px h-6 bg-gray-700 mx-1" />
            <Link
              href={`/cases/${Array.from(selected)[0]}`}
              className="flex items-center gap-2 px-3 py-2 text-sky-400 hover:text-sky-300 text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Case Detail
            </Link>
          </>
        )}

        <div className="ml-auto text-xs text-gray-600">
          {selected.size > 0 ? `${selected.size} case${selected.size !== 1 ? "s" : ""} selected` : "No cases selected"}
        </div>
      </div>
    </div>
  );
}
