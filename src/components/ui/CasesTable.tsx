"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/constants";

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
  totalValue: number;
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
}

export default function CasesTable({ cases, onStatusChange }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("receivedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = cases
    .filter((c) => {
      const q = search.toLowerCase();
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.dentalAccount.name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av: string | number = a[sortKey] as string | number ?? "";
      let bv: string | number = b[sortKey] as string | number ?? "";
      if (sortKey === "receivedDate" || sortKey === "dueDate") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : null;

  const statusOptions = ["INCOMING", "IN_LAB", "WIP", "HOLD", "REMAKE", "COMPLETE", "SHIPPED"];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search cases, patients, accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
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
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${key ? "cursor-pointer hover:text-gray-200" : ""}`}
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
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No cases found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-sky-400 hover:text-sky-300 hover:underline underline-offset-2 transition-colors"
                      >
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                      {c.patientName}
                      {c.pan && <span className="ml-1 text-xs text-gray-500">Pan: {c.pan}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      <p>{c.dentalAccount.name}</p>
                      {c.dentalAccount.doctorName && (
                        <p className="text-xs text-gray-500">Dr. {c.dentalAccount.doctorName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {onStatusChange ? (
                        <select
                          value={c.status}
                          onChange={(e) => onStatusChange(c.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border font-medium bg-transparent cursor-pointer focus:outline-none ${STATUS_COLORS[c.status]}`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s} className="bg-gray-800 text-white">
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[c.status]}`}>
                          {c.status}
                        </span>
                      )}
                      {c.priority !== "NORMAL" && (
                        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[c.priority]}`}>
                          {c.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {c.items.slice(0, 2).map((item) => (
                          <span key={item.id} className="text-xs bg-gray-700/60 text-gray-300 px-1.5 py-0.5 rounded">
                            {item.productType} ×{item.units}
                          </span>
                        ))}
                        {c.items.length > 2 && (
                          <span className="text-xs text-gray-500">+{c.items.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {formatDate(c.receivedDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span className={c.dueDate && new Date(c.dueDate) < new Date() ? "text-red-400" : "text-gray-400"}>
                        {formatDate(c.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-400 whitespace-nowrap">
                      {formatCurrency(c.totalValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-700/30 text-xs text-gray-500">
          {filtered.length} of {cases.length} cases
        </div>
      </div>
    </div>
  );
}
