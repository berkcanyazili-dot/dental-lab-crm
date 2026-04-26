"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  GripVertical,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Settings2,
  Trash2,
  Workflow,
} from "lucide-react";

interface LabSettings {
  labName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  defaultTurnaroundDays: number;
  defaultShippingCarrier: string | null;
  defaultShippingTime: string | null;
  workTicketFooter: string | null;
  stripeConnectedAccountId: string | null;
  stripeApplicationFeeBasisPoints: number;
}

interface ServiceProduct {
  id?: string;
  name: string;
  department: string;
  defaultPrice: number | string;
  isActive: boolean;
  sortOrder: number;
}

interface WorkflowStep {
  id?: string;
  department: string;
  sortOrder: number;
  leadDays: number;
  isActive: boolean;
}

type Tab = "profile" | "services" | "workflow";

const EMPTY_SETTINGS: LabSettings = {
  labName: "Dental Lab CRM",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  defaultTurnaroundDays: 7,
  defaultShippingCarrier: "",
  defaultShippingTime: "",
  workTicketFooter: "",
  stripeConnectedAccountId: "",
  stripeApplicationFeeBasisPoints: 0,
};

function newProduct(sortOrder: number): ServiceProduct {
  return {
    name: "New Service",
    department: "Fixed",
    defaultPrice: 0,
    isActive: true,
    sortOrder,
  };
}

function newWorkflowStep(sortOrder: number): WorkflowStep {
  return {
    department: "New Step",
    sortOrder,
    leadDays: 1,
    isActive: true,
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</label>;
}

export default function LabSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [settings, setSettings] = useState<LabSettings>(EMPTY_SETTINGS);
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/lab")
      .then((response) => response.json())
      .then((data) => {
        setSettings({ ...EMPTY_SETTINGS, ...(data.settings ?? {}) });
        setProducts(Array.isArray(data.products) ? data.products : []);
        setWorkflow(Array.isArray(data.workflow) ? data.workflow : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.department).filter(Boolean))).sort();
  }, [products]);

  const productsByDepartment = useMemo(() => {
    return departments.map((department) => ({
      department,
      products: products
        .filter((product) => product.department === department)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }));
  }, [departments, products]);

  function updateProduct(index: number, patch: Partial<ServiceProduct>) {
    setProducts((current) => current.map((product, i) => (i === index ? { ...product, ...patch } : product)));
  }

  function updateWorkflow(index: number, patch: Partial<WorkflowStep>) {
    setWorkflow((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/settings/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          products,
          workflow,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSettings({ ...EMPTY_SETTINGS, ...(data.settings ?? {}) });
        setProducts(Array.isArray(data.products) ? data.products : products);
        setWorkflow(Array.isArray(data.workflow) ? data.workflow : workflow);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading lab settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lab Customization</h1>
          <p className="mt-1 text-sm text-gray-400">Configure lab profile, service catalog, pricing defaults, and workflow steps.</p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved" : "Save Customization"}
        </button>
      </div>

      <div className="mb-5 flex border-b border-gray-800">
        {[
          { key: "profile", label: "Lab Profile", icon: Building2 },
          { key: "services", label: "Services", icon: PackagePlus },
          { key: "workflow", label: "Workflow", icon: Workflow },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as Tab)}
            className={`flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${
              activeTab === key
                ? "border-sky-400 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <section className="max-w-4xl rounded-xl border border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <Settings2 className="h-4 w-4 text-sky-400" />
            <h2 className="font-semibold text-white">Lab Profile Defaults</h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel>Lab Name</FieldLabel>
              <input value={settings.labName} onChange={(event) => setSettings((current) => ({ ...current, labName: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input value={settings.phone ?? ""} onChange={(event) => setSettings((current) => ({ ...current, phone: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input value={settings.email ?? ""} onChange={(event) => setSettings((current) => ({ ...current, email: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Address</FieldLabel>
              <input value={settings.address ?? ""} onChange={(event) => setSettings((current) => ({ ...current, address: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div>
              <FieldLabel>City</FieldLabel>
              <input value={settings.city ?? ""} onChange={(event) => setSettings((current) => ({ ...current, city: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>State</FieldLabel>
                <input value={settings.state ?? ""} onChange={(event) => setSettings((current) => ({ ...current, state: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
              <div>
                <FieldLabel>Zip</FieldLabel>
                <input value={settings.zip ?? ""} onChange={(event) => setSettings((current) => ({ ...current, zip: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
            </div>
            <div>
              <FieldLabel>Default Turnaround Days</FieldLabel>
              <input type="number" min={1} value={settings.defaultTurnaroundDays} onChange={(event) => setSettings((current) => ({ ...current, defaultTurnaroundDays: Number(event.target.value) || 7 }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Default Carrier</FieldLabel>
                <input value={settings.defaultShippingCarrier ?? ""} onChange={(event) => setSettings((current) => ({ ...current, defaultShippingCarrier: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
              <div>
                <FieldLabel>Default Ship Time</FieldLabel>
                <input value={settings.defaultShippingTime ?? ""} onChange={(event) => setSettings((current) => ({ ...current, defaultShippingTime: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Work Ticket Footer</FieldLabel>
              <textarea value={settings.workTicketFooter ?? ""} onChange={(event) => setSettings((current) => ({ ...current, workTicketFooter: event.target.value }))} className="h-24 w-full resize-none rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div>
              <FieldLabel>Stripe Connected Account</FieldLabel>
              <input value={settings.stripeConnectedAccountId ?? ""} onChange={(event) => setSettings((current) => ({ ...current, stripeConnectedAccountId: event.target.value }))} placeholder="acct_..." className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
            <div>
              <FieldLabel>Platform Fee (bps)</FieldLabel>
              <input type="number" min={0} max={10000} value={settings.stripeApplicationFeeBasisPoints} onChange={(event) => setSettings((current) => ({ ...current, stripeApplicationFeeBasisPoints: Number(event.target.value) || 0 }))} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-sky-500" />
            </div>
          </div>
        </section>
      )}

      {activeTab === "services" && (
        <section className="rounded-xl border border-gray-800 bg-gray-950">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-sky-400" />
              <h2 className="font-semibold text-white">Service Catalog</h2>
            </div>
            <button type="button" onClick={() => setProducts((current) => [...current, newProduct(current.length)])} className="flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-500">
              <Plus className="h-4 w-4" />
              Add Service
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {productsByDepartment.map(({ department, products: departmentProducts }) => (
              <div key={department} className="p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">{department}</h3>
                <div className="space-y-2">
                  {departmentProducts.map((product) => {
                    const index = products.indexOf(product);
                    return (
                      <div key={product.id ?? `${product.department}-${product.name}-${index}`} className="grid gap-2 rounded-lg border border-gray-800 bg-gray-900 p-2 md:grid-cols-[28px_1fr_160px_120px_90px_80px_36px]">
                        <div className="flex items-center justify-center text-gray-600"><GripVertical className="h-4 w-4" /></div>
                        <input value={product.name} onChange={(event) => updateProduct(index, { name: event.target.value })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                        <input value={product.department} onChange={(event) => updateProduct(index, { department: event.target.value })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                        <input type="number" min={0} step="0.01" value={String(product.defaultPrice)} onChange={(event) => updateProduct(index, { defaultPrice: event.target.value })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                        <input type="number" min={0} value={product.sortOrder} onChange={(event) => updateProduct(index, { sortOrder: Number(event.target.value) || 0 })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                        <label className="flex items-center justify-center gap-2 text-xs text-gray-300">
                          <input type="checkbox" checked={product.isActive} onChange={(event) => updateProduct(index, { isActive: event.target.checked })} className="h-4 w-4 accent-sky-500" />
                          Active
                        </label>
                        <button type="button" onClick={() => setProducts((current) => current.filter((_, i) => i !== index))} className="flex h-9 items-center justify-center rounded border border-gray-700 text-gray-500 hover:border-red-500 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "workflow" && (
        <section className="max-w-5xl rounded-xl border border-gray-800 bg-gray-950">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-sky-400" />
              <h2 className="font-semibold text-white">Workflow Step Templates</h2>
            </div>
            <button type="button" onClick={() => setWorkflow((current) => [...current, newWorkflowStep(current.length)])} className="flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-500">
              <Plus className="h-4 w-4" />
              Add Step
            </button>
          </div>
          <div className="space-y-2 p-4">
            {workflow
              .map((step, index) => ({ step, index }))
              .sort((a, b) => a.step.sortOrder - b.step.sortOrder)
              .map(({ step, index }) => (
                <div key={step.id ?? `${step.department}-${index}`} className="grid gap-2 rounded-lg border border-gray-800 bg-gray-900 p-2 md:grid-cols-[28px_1fr_110px_110px_90px_36px]">
                  <div className="flex items-center justify-center text-gray-600"><GripVertical className="h-4 w-4" /></div>
                  <input value={step.department} onChange={(event) => updateWorkflow(index, { department: event.target.value })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                  <input type="number" min={0} value={step.sortOrder} onChange={(event) => updateWorkflow(index, { sortOrder: Number(event.target.value) || 0 })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                  <input type="number" min={1} value={step.leadDays} onChange={(event) => updateWorkflow(index, { leadDays: Number(event.target.value) || 1 })} className="h-9 rounded border border-gray-700 bg-gray-950 px-2 text-sm text-white outline-none focus:border-sky-500" />
                  <label className="flex items-center justify-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" checked={step.isActive} onChange={(event) => updateWorkflow(index, { isActive: event.target.checked })} className="h-4 w-4 accent-sky-500" />
                    Active
                  </label>
                  <button type="button" onClick={() => setWorkflow((current) => current.filter((_, i) => i !== index))} className="flex h-9 items-center justify-center rounded border border-gray-700 text-gray-500 hover:border-red-500 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
