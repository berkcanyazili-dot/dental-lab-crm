"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, Plus, ChevronUp, ChevronDown, Trash2,
  Shield, RefreshCw, Save, X, ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */
interface CaseResult {
  id: string;
  caseNumber: string;
  patientName: string;
  caseType: string;
  dentalAccount: { name: string; doctorName: string | null };
}

interface FDALot {
  id: string;
  itemName: string;
  manufacturer: string | null;
  lotNumber: string;
  userName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function FDALotsPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundCase, setFoundCase] = useState<CaseResult | null>(null);

  const [lots, setLots] = useState<FDALot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // Add-form state
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: "", manufacturer: "", lotNumber: "" });
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ itemName: "", manufacturer: "", lotNumber: "" });

  const loadLots = useCallback(async (caseId: string) => {
    setLoadingLots(true);
    const res = await fetch(`/api/fda-lots?caseId=${caseId}`);
    const data = await res.json();
    setLots(Array.isArray(data) ? data : []);
    setLoadingLots(false);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setFoundCase(null);
    setLots([]);
    setShowForm(false);

    const res = await fetch(`/api/cases?caseNumber=${encodeURIComponent(query.trim().toUpperCase())}`);
    const data = await res.json();
    setSearching(false);

    if (!Array.isArray(data) || data.length === 0) {
      setSearchError(`No case found matching "${query.trim()}"`);
      return;
    }
    const c = data[0];
    setFoundCase(c);
    await loadLots(c.id);
  };

  const handleAddSave = async () => {
    if (!foundCase || !newItem.itemName || !newItem.lotNumber) return;
    setSaving(true);
    await fetch("/api/fda-lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: foundCase.id, ...newItem }),
    });
    setNewItem({ itemName: "", manufacturer: "", lotNumber: "" });
    setShowForm(false);
    await loadLots(foundCase.id);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lot record?")) return;
    await fetch(`/api/fda-lots/${id}`, { method: "DELETE" });
    if (foundCase) await loadLots(foundCase.id);
  };

  const handleMove = async (index: number, dir: "up" | "down") => {
    if (!foundCase) return;
    const swapIndex = dir === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= lots.length) return;

    const a = lots[index];
    const b = lots[swapIndex];

    await Promise.all([
      fetch(`/api/fda-lots/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/fda-lots/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    await loadLots(foundCase.id);
  };

  const startEdit = (lot: FDALot) => {
    setEditingId(lot.id);
    setEditFields({ itemName: lot.itemName, manufacturer: lot.manufacturer ?? "", lotNumber: lot.lotNumber });
  };

  const handleEditSave = async (id: string) => {
    await fetch(`/api/fda-lots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: editFields.itemName, manufacturer: editFields.manufacturer || null, lotNumber: editFields.lotNumber }),
    });
    setEditingId(null);
    if (foundCase) await loadLots(foundCase.id);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">FDA Lot Tracking</h1>
          <p className="text-sm text-gray-400">Track material lot numbers per case for FDA compliance</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter case number (e.g. DL-00001)"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </form>

      {searchError && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
          {searchError}
        </div>
      )}

      {/* Case info card */}
      {foundCase && (
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm flex-1">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Case #</p>
                <p className="font-mono font-bold text-sky-400">{foundCase.caseNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Account</p>
                <p className="font-medium text-white">{foundCase.dentalAccount.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Doctor</p>
                <p className="font-medium text-white">
                  {foundCase.dentalAccount.doctorName ? `Dr. ${foundCase.dentalAccount.doctorName}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Patient</p>
                <p className="font-medium text-white">{foundCase.patientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Case Type</p>
                <p className="font-medium text-white">{foundCase.caseType}</p>
              </div>
            </div>
            <Link
              href={`/cases/${foundCase.id}`}
              target="_blank"
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Case
            </Link>
          </div>
        </div>
      )}

      {/* Lot items */}
      {foundCase && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
              FDA Lot Records
              {lots.length > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal normal-case">{lots.length} item{lots.length !== 1 ? "s" : ""}</span>
              )}
            </h2>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Item
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="bg-gray-800/80 border border-emerald-700/30 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">New Lot Item</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Item Name *</label>
                  <input
                    value={newItem.itemName}
                    onChange={(e) => setNewItem((p) => ({ ...p, itemName: e.target.value }))}
                    placeholder="e.g. Zirconia Disc"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Manufacturer</label>
                  <input
                    value={newItem.manufacturer}
                    onChange={(e) => setNewItem((p) => ({ ...p, manufacturer: e.target.value }))}
                    placeholder="e.g. Ivoclar Vivadent"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Lot Number *</label>
                  <input
                    value={newItem.lotNumber}
                    onChange={(e) => setNewItem((p) => ({ ...p, lotNumber: e.target.value }))}
                    placeholder="e.g. 2024-A1-0042"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddSave}
                  disabled={saving || !newItem.itemName || !newItem.lotNumber}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewItem({ itemName: "", manufacturer: "", lotNumber: "" }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Lots table */}
          {loadingLots ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
            </div>
          ) : lots.length === 0 ? (
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-5 py-10 text-center text-sm text-gray-500">
              No lot items recorded for this case. Click &ldquo;Add New Item&rdquo; to get started.
            </div>
          ) : (
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50 bg-gray-900/40">
                    <th className="w-16 px-2 py-2.5 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Order</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Item Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Manufacturer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Lot Number</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="w-16 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {lots.map((lot, index) => (
                    <tr key={lot.id} className="hover:bg-gray-700/20 transition-colors">
                      {/* Move buttons */}
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => handleMove(index, "up")}
                            disabled={index === 0}
                            className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMove(index, "down")}
                            disabled={index === lots.length - 1}
                            className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {editingId === lot.id ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              value={editFields.itemName}
                              onChange={(e) => setEditFields((p) => ({ ...p, itemName: e.target.value }))}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={editFields.manufacturer}
                              onChange={(e) => setEditFields((p) => ({ ...p, manufacturer: e.target.value }))}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={editFields.lotNumber}
                              onChange={(e) => setEditFields((p) => ({ ...p, lotNumber: e.target.value }))}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{lot.userName}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(lot.updatedAt)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleEditSave(lot.id)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors">
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            className="px-4 py-3 font-medium text-white cursor-pointer"
                            onClick={() => startEdit(lot)}
                          >
                            {lot.itemName}
                          </td>
                          <td className="px-4 py-3 text-gray-300 cursor-pointer" onClick={() => startEdit(lot)}>
                            {lot.manufacturer ?? <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-emerald-400 cursor-pointer" onClick={() => startEdit(lot)}>
                            {lot.lotNumber}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{lot.userName}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(lot.updatedAt)}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDelete(lot.id)}
                              className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
