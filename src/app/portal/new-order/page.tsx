"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { PRODUCT_TYPES } from "@/lib/constants";

interface OrderItem {
  id: string;
  productType: string;
  toothNumbers: string;
  units: number;
  shade: string;
  material: string;
  notes: string;
}

const MATERIALS = ["", "Zirconia", "E.max", "PFM", "High Noble", "Titanium", "Acrylic", "Other"];

function emptyItem(): OrderItem {
  return {
    id: `${Date.now()}-${Math.random()}`,
    productType: PRODUCT_TYPES[0],
    toothNumbers: "",
    units: 1,
    shade: "",
    material: "",
    notes: "",
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</label>;
}

export default function PortalNewOrderPage() {
  const router = useRouter();
  const [patientFirst, setPatientFirst] = useState("");
  const [patientLast, setPatientLast] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [caseType, setCaseType] = useState("NEW");
  const [priority, setPriority] = useState("NORMAL");
  const [route, setRoute] = useState("LOCAL");
  const [dueDate, setDueDate] = useState("");
  const [pan, setPan] = useState("");
  const [shade, setShade] = useState("");
  const [selectedTeeth, setSelectedTeeth] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [materialsReceived, setMaterialsReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateItem(id: string, patch: Partial<OrderItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!patientFirst.trim() || !patientLast.trim()) {
      setError("Patient first and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/portal/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: `${patientFirst.trim()} ${patientLast.trim()}`,
          patientFirst: patientFirst.trim(),
          patientLast: patientLast.trim(),
          patientAge: patientAge ? Number(patientAge) : null,
          caseType,
          priority,
          route,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          pan: pan || null,
          shade: shade || null,
          selectedTeeth: selectedTeeth || null,
          shippingAddress: shippingAddress || null,
          materialsReceived: materialsReceived || null,
          notes: notes || null,
          items: items.map((item) => ({
            productType: item.productType,
            toothNumbers: item.toothNumbers || selectedTeeth || null,
            units: item.units,
            shade: item.shade || shade || null,
            material: item.material || null,
            notes: item.notes || null,
            price: 0,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Order could not be submitted.");
        return;
      }

      router.push("/portal");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <Link href="/portal" className="mb-2 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to portal
            </Link>
            <h1 className="text-xl font-bold text-white">Submit New Lab Order</h1>
          </div>
          <button
            type="submit"
            form="portal-order-form"
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Submit Order
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <form id="portal-order-form" onSubmit={handleSubmit} className="space-y-4">
          <section className="border border-slate-800 bg-slate-900">
            <div className="flex h-10 items-center gap-2 border-b border-slate-800 px-4">
              <UserRound className="h-4 w-4 text-sky-300" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Patient</h2>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_120px]">
              <div>
                <FieldLabel>First Name</FieldLabel>
                <input required value={patientFirst} onChange={(event) => setPatientFirst(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
              <div>
                <FieldLabel>Last Name</FieldLabel>
                <input required value={patientLast} onChange={(event) => setPatientLast(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
              <div>
                <FieldLabel>Age</FieldLabel>
                <input type="number" value={patientAge} onChange={(event) => setPatientAge(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
            </div>
          </section>

          <section className="border border-slate-800 bg-slate-900">
            <div className="flex h-10 items-center gap-2 border-b border-slate-800 px-4">
              <CalendarDays className="h-4 w-4 text-sky-300" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Order Details</h2>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-4">
              <div>
                <FieldLabel>Case Type</FieldLabel>
                <select value={caseType} onChange={(event) => setCaseType(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400">
                  <option value="NEW">New</option>
                  <option value="REMAKE">Remake</option>
                  <option value="REPAIR">Repair</option>
                </select>
              </div>
              <div>
                <FieldLabel>Priority</FieldLabel>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400">
                  <option value="NORMAL">Normal</option>
                  <option value="RUSH">Rush</option>
                  <option value="STAT">Stat</option>
                </select>
              </div>
              <div>
                <FieldLabel>Delivery Due Date</FieldLabel>
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
              <div>
                <FieldLabel>Pan Number</FieldLabel>
                <input value={pan} onChange={(event) => setPan(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
              <div>
                <FieldLabel>Route</FieldLabel>
                <select value={route} onChange={(event) => setRoute(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400">
                  <option value="LOCAL">Local</option>
                  <option value="PICKUP">Pickup requested</option>
                  <option value="SHIP">Ship</option>
                </select>
              </div>
              <div>
                <FieldLabel>Shade</FieldLabel>
                <input value={shade} onChange={(event) => setShade(event.target.value)} placeholder="A2, BL1..." className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Teeth / Arches</FieldLabel>
                <input value={selectedTeeth} onChange={(event) => setSelectedTeeth(event.target.value)} placeholder="8, 9, 10 or Upper Full" className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
              <div className="md:col-span-4">
                <FieldLabel>Shipping / Pickup Address</FieldLabel>
                <input value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
              </div>
            </div>
          </section>

          <section className="border border-slate-800 bg-slate-900">
            <div className="flex h-10 items-center justify-between border-b border-slate-800 px-4">
              <div className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">Products / Restorations</h2>
              </div>
              <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200">
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-2 p-4">
              {items.map((item) => (
                <div key={item.id} className="grid gap-2 border border-slate-800 bg-slate-950 p-3 md:grid-cols-[1.2fr_140px_80px_110px_120px_36px]">
                  <select value={item.productType} onChange={(event) => updateItem(item.id, { productType: event.target.value })} className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-sm text-white outline-none focus:border-sky-400">
                    {PRODUCT_TYPES.map((product) => <option key={product}>{product}</option>)}
                  </select>
                  <input value={item.toothNumbers} onChange={(event) => updateItem(item.id, { toothNumbers: event.target.value })} placeholder="Tooth #" className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-sm text-white outline-none focus:border-sky-400" />
                  <input type="number" min={1} value={item.units} onChange={(event) => updateItem(item.id, { units: Math.max(1, Number(event.target.value) || 1) })} className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-sm text-white outline-none focus:border-sky-400" />
                  <input value={item.shade} onChange={(event) => updateItem(item.id, { shade: event.target.value })} placeholder="Shade" className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-sm text-white outline-none focus:border-sky-400" />
                  <select value={item.material} onChange={(event) => updateItem(item.id, { material: event.target.value })} className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-sm text-white outline-none focus:border-sky-400">
                    {MATERIALS.map((material) => <option key={material} value={material}>{material || "Material"}</option>)}
                  </select>
                  <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} className="flex h-9 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300 disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">Materials Sent</h2>
              </div>
              <textarea value={materialsReceived} onChange={(event) => setMaterialsReceived(event.target.value)} placeholder="Scans, impressions, bite, photos, models..." className="h-32 w-full resize-none rounded border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400" />
            </div>
            <div className="border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">Instructions</h2>
              </div>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Doctor instructions for the lab..." className="h-32 w-full resize-none rounded border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400" />
            </div>
          </section>

          {error && <div className="border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100">{error}</div>}
        </form>
      </main>
    </div>
  );
}
