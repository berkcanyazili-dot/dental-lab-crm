"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { PRODUCT_TYPES } from "@/lib/constants";

interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
}

interface Technician {
  id: string;
  name: string;
}

interface CaseItemInput {
  productType: string;
  units: number;
  shade: string;
  toothNumbers: string;
  price: number;
  notes: string;
}

interface Props {
  defaultStatus?: string;
  onClose: () => void;
  onSaved: () => void;
}

const emptyItem = (): CaseItemInput => ({
  productType: PRODUCT_TYPES[0],
  units: 1,
  shade: "",
  toothNumbers: "",
  price: 0,
  notes: "",
});

export default function NewCaseModal({ defaultStatus = "INCOMING", onClose, onSaved }: Props) {
  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientName: "",
    dentalAccountId: "",
    technicianId: "",
    status: defaultStatus,
    priority: "NORMAL",
    dueDate: "",
    pan: "",
    shade: "",
    notes: "",
  });
  const [items, setItems] = useState<CaseItemInput[]>([emptyItem()]);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/technicians").then((r) => r.json()),
    ]).then(([accs, techs]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      setTechnicians(Array.isArray(techs) ? techs : []);
    });
  }, []);

  const updateItem = (idx: number, field: keyof CaseItemInput, val: string | number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          technicianId: form.technicianId || null,
          dueDate: form.dueDate || null,
          items: items.map((it) => ({ ...it, price: Number(it.price), units: Number(it.units) })),
        }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">New Case</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Patient Name *</label>
              <input
                required
                value={form.patientName}
                onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
                placeholder="Patient full name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Account *</label>
              <select
                required
                value={form.dentalAccountId}
                onChange={(e) => setForm((f) => ({ ...f, dentalAccountId: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.doctorName ? ` — Dr. ${a.doctorName}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Technician</label>
              <select
                value={form.technicianId}
                onChange={(e) => setForm((f) => ({ ...f, technicianId: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {["INCOMING", "IN_LAB", "WIP", "HOLD", "REMAKE", "COMPLETE", "SHIPPED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {["NORMAL", "RUSH", "STAT"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pan #</label>
              <input
                value={form.pan}
                onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
                placeholder="Pan number"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Shade</label>
              <input
                value={form.shade}
                onChange={(e) => setForm((f) => ({ ...f, shade: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
                placeholder="e.g. A2, B1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 resize-none"
                placeholder="Any notes for this case…"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Products / Items</label>
              <button
                type="button"
                onClick={() => setItems((p) => [...p, emptyItem()])}
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <select
                      value={item.productType}
                      onChange={(e) => updateItem(idx, "productType", e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {PRODUCT_TYPES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Teeth #"
                      value={item.toothNumbers}
                      onChange={(e) => updateItem(idx, "toothNumbers", e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={item.units}
                      onChange={(e) => updateItem(idx, "units", e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      placeholder="Shade"
                      value={item.shade}
                      onChange={(e) => updateItem(idx, "shade", e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => updateItem(idx, "price", e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="text-gray-600 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
