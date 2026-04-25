"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Search, X, Phone, Mail, Trash2 } from "lucide-react";

interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  _count: { cases: number };
}

const emptyForm = {
  name: "", doctorName: "", email: "", phone: "", fax: "",
  address: "", city: "", state: "", zip: "", notes: "",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setAccounts(d) : setAccounts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove account "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v || null])
    );
    body.name = form.name;
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.doctorName?.toLowerCase() ?? "").includes(q) ||
      (a.email?.toLowerCase() ?? "").includes(q)
    );
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-sm text-gray-400 mt-1">Dental office client accounts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Account
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">New Account</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
            {[
              { key: "name", label: "Practice Name *", required: true, cols: 2 },
              { key: "doctorName", label: "Doctor Name", cols: 1 },
              { key: "phone", label: "Phone", cols: 1 },
              { key: "email", label: "Email", cols: 1 },
              { key: "fax", label: "Fax", cols: 1 },
              { key: "address", label: "Address", cols: 2 },
              { key: "city", label: "City", cols: 1 },
              { key: "state", label: "State", cols: 1 },
              { key: "zip", label: "ZIP", cols: 1 },
            ].map(({ key, label, required, cols }) => (
              <div key={key} className={cols === 2 ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
                <input
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            ))}
            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? "Saving…" : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-500">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{search ? "No accounts match your search" : "No accounts yet. Add one above."}</p>
            </div>
          ) : (
            filtered.map((a) => (
              <div key={a.id} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{a.name}</p>
                    {a.doctorName && <p className="text-sm text-gray-400">Dr. {a.doctorName}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                      {a.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => handleDelete(a.id, a.name)}
                      disabled={deletingId === a.id}
                      className="p-1 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Remove account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {a.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{a.phone}</span>
                    </div>
                  )}
                  {a.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{a.email}</span>
                    </div>
                  )}
                  {(a.city || a.state) && (
                    <p className="text-sm text-gray-500">{[a.city, a.state].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <span className="text-2xl font-bold text-white">{a._count.cases}</span>
                  <span className="text-sm text-gray-500 ml-1">total cases</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
