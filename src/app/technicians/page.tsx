"use client";

import { useEffect, useState } from "react";
import { Users, Plus, X } from "lucide-react";

interface Technician {
  id: string;
  name: string;
  specialty: string | null;
  isActive: boolean;
  _count: { cases: number };
}

export default function TechniciansPage() {
  const [techs, setTechs] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", specialty: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/technicians")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setTechs(d) : setTechs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setForm({ name: "", specialty: "" });
    setShowForm(false);
    load();
  };

  const specialties = [
    "Crown & Bridge", "Implants", "Full Arch", "Cosmetics",
    "Dentures", "Partials", "Orthodontics", "General",
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Technicians</h1>
          <p className="text-sm text-gray-400 mt-1">Lab staff and their case assignments</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Technician
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">New Technician</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="flex-1 px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
            />
            <select
              value={form.specialty}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              className="flex-1 px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">Specialty (optional)</option>
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {techs.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No technicians yet. Add one above.</p>
            </div>
          ) : (
            techs.map((t) => (
              <div key={t.id} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-full bg-sky-600/30 flex items-center justify-center text-sky-400 font-bold text-sm">
                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.specialty ?? "General"}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-1">
                  <span className="text-2xl font-bold text-white">{t._count.cases}</span>
                  <span className="text-sm text-gray-500">cases assigned</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
