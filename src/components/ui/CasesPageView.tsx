"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import CasesTable from "./CasesTable";
import NewCaseModal from "./NewCaseModal";

interface Case {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  priority: string;
  receivedDate: string;
  dueDate: string | null;
  totalValue: number;
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
}

export default function CasesPageView({ title, description, statusFilter, allowStatusChange }: Props) {
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const searchQuery = searchParams.get("search") ?? "";

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/cases?status=${statusFilter}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setCases(d) : setCases([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const totalValue = cases.reduce((s, c) => s + c.totalValue, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-lg font-bold text-green-400">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(totalValue)}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Case
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        </div>
      ) : (
        <CasesTable
          cases={cases}
          onStatusChange={allowStatusChange ? handleStatusChange : undefined}
          initialSearch={searchQuery}
        />
      )}

      {showModal && (
        <NewCaseModal
          defaultStatus={statusFilter.split(",")[0]}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
