"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CasesTable from "./CasesTable";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

interface Case {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  priority: string;
  receivedDate: string;
  dueDate: string | null;
  totalValue: number | string;
  pan: string | null;
  shade: string | null;
  dentalAccount: { id: string; name: string; doctorName: string | null };
  technician: { id: string; name: string } | null;
  items: { id: string; productType: string; units: number; price: number }[];
}

interface Props {
  title: string;
  description: string;
  statusFilter: string;
  allowStatusChange?: boolean;
  initialSearch?: string;
}

const STATUS_OPTIONS = ["INCOMING", "IN_LAB", "WIP", "HOLD", "REMAKE", "COMPLETE", "SHIPPED"];

export default function CasesPageView({
  title,
  description,
  statusFilter,
  allowStatusChange,
  initialSearch = "",
}: Props) {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [submittingBulkUpdate, setSubmittingBulkUpdate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/cases?status=${statusFilter}`)
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setCases(d) : setCases([])))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setSelectedCaseIds((current) => current.filter((id) => cases.some((c) => c.id === id)));
  }, [cases]);

  useBarcodeScanner((caseNumber) => {
    router.push(`/cases/${encodeURIComponent(caseNumber.toUpperCase())}`);
  });

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedCaseIds.length === 0) {
      return;
    }

    setSubmittingBulkUpdate(true);
    try {
      const response = await fetch("/api/cases/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseIds: selectedCaseIds,
          status: bulkStatus,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Bulk status update failed.");
      }

      setSelectedCaseIds([]);
      setBulkStatus("");
      load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Bulk status update failed.");
    } finally {
      setSubmittingBulkUpdate(false);
    }
  };

  const totalValue = useMemo(
    () => cases.reduce((sum, c) => sum + Number(c.totalValue), 0),
    [cases]
  );

  return (
    <div className="space-y-5 p-6 pb-28">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-lg font-bold text-green-400">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
              }).format(totalValue)}
            </p>
          </div>
          <Link
            href="/cases/new"
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500"
          >
            <Plus className="h-4 w-4" />
            New Case
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500" />
        </div>
      ) : (
        <CasesTable
          cases={cases}
          onStatusChange={allowStatusChange ? handleStatusChange : undefined}
          search={search}
          onSearchChange={setSearch}
          selectedCaseIds={selectedCaseIds}
          onSelectedCaseIdsChange={setSelectedCaseIds}
        />
      )}

      {selectedCaseIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-sky-700/40 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur">
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedCaseIds.length} case{selectedCaseIds.length === 1 ? "" : "s"} selected
              </p>
              <p className="text-xs text-slate-400">
                Scan a barcode anytime to jump straight to a case.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="">Select new status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || submittingBulkUpdate}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingBulkUpdate ? "Updating..." : "Apply"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCaseIds([])}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
