"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/constants";

interface CaseItem {
  id: string;
  productType: string;
  units: number;
  price: number;
}

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
  items: CaseItem[];
}

type SortKey = "caseNumber" | "patientName" | "receivedDate" | "dueDate" | "totalValue";

interface Props {
  cases: Case[];
  onStatusChange?: (id: string, status: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedCaseIds: string[];
  onSelectedCaseIdsChange: (ids: string[]) => void;
}

export default function CasesTable({
  cases,
  onStatusChange,
  search,
  onSearchChange,
  selectedCaseIds,
  onSelectedCaseIdsChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("receivedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases
      .filter((c) => {
        if (!q) return true;
        return (
          c.caseNumber.toLowerCase().includes(q) ||
          c.patientName.toLowerCase().includes(q) ||
          c.dentalAccount.name.toLowerCase().includes(q) ||
          c.items.some((item) => item.productType.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        let av: string | number = (a[sortKey] as string | number) ?? "";
        let bv: string | number = (b[sortKey] as string | number) ?? "";
        if (sortKey === "receivedDate" || sortKey === "dueDate") {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [cases, search, sortDir, sortKey]);

  const filteredIds = filtered.map((c) => c.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedCaseIds.includes(id));
  const someFilteredSelected =
    filteredIds.some((id) => selectedCaseIds.includes(id)) && !allFilteredSelected;

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someFilteredSelected;
    }
  }, [someFilteredSelected]);

  const toggleSelectedCase = (caseId: string) => {
    onSelectedCaseIdsChange(
      selectedCaseIds.includes(caseId)
        ? selectedCaseIds.filter((id) => id !== caseId)
        : [...selectedCaseIds, caseId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      onSelectedCaseIdsChange(selectedCaseIds.filter((id) => !filteredIds.includes(id)));
      return;
    }

    onSelectedCaseIdsChange(Array.from(new Set([...selectedCaseIds, ...filteredIds])));
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
    ) : null;

  const statusOptions = ["INCOMING", "IN_LAB", "WIP", "HOLD", "REMAKE", "COMPLETE", "SHIPPED"];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search cases, patients, accounts..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-sky-500 focus:ring-sky-500"
                    aria-label="Select all visible cases"
                  />
                </th>
                {[
                  { key: "caseNumber", label: "Case #" },
                  { key: "patientName", label: "Patient" },
                  { key: null, label: "Account" },
                  { key: null, label: "Status" },
                  { key: null, label: "Products" },
                  { key: "receivedDate", label: "Received" },
                  { key: "dueDate", label: "Due" },
                  { key: "totalValue", label: "Value" },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key as SortKey)}
                    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 ${
                      key ? "cursor-pointer hover:text-gray-200" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {key && <SortIcon k={key as SortKey} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No cases found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-gray-700/20">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.includes(c.id)}
                        onChange={() => toggleSelectedCase(c.id)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-sky-500 focus:ring-sky-500"
                        aria-label={`Select ${c.caseNumber}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium">
                      <Link
                        href={`/cases/${encodeURIComponent(c.caseNumber)}`}
                        className="text-sky-400 transition-colors hover:text-sky-300 hover:underline"
                      >
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                      {c.patientName}
                      {c.pan && <span className="ml-1 text-xs text-gray-500">Pan: {c.pan}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                      <p>{c.dentalAccount.name}</p>
                      {c.dentalAccount.doctorName && (
                        <p className="text-xs text-gray-500">Dr. {c.dentalAccount.doctorName}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {onStatusChange ? (
                        <select
                          value={c.status}
                          onChange={(e) => onStatusChange(c.id, e.target.value)}
                          className={`cursor-pointer rounded-full border bg-transparent px-2 py-1 text-xs font-medium focus:outline-none ${STATUS_COLORS[c.status]}`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s} className="bg-gray-800 text-white">
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}
                        >
                          {c.status}
                        </span>
                      )}
                      {c.priority !== "NORMAL" && (
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[c.priority]}`}
                        >
                          {c.priority}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-gray-300">
                      <div className="flex flex-wrap gap-1">
                        {c.items.slice(0, 2).map((item) => (
                          <span
                            key={item.id}
                            className="rounded bg-gray-700/60 px-1.5 py-0.5 text-xs text-gray-300"
                          >
                            {item.productType} x{item.units}
                          </span>
                        ))}
                        {c.items.length > 2 && (
                          <span className="text-xs text-gray-500">+{c.items.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                      {formatDate(c.receivedDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      <span
                        className={
                          c.dueDate && new Date(c.dueDate) < new Date() ? "text-red-400" : "text-gray-400"
                        }
                      >
                        {formatDate(c.dueDate)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-green-400">
                      {formatCurrency(Number(c.totalValue))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-700/30 px-4 py-2 text-xs text-gray-500">
          {filtered.length} of {cases.length} cases
        </div>
      </div>
    </div>
  );
}
