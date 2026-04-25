"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  Loader2,
  PackagePlus,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import ToothDiagram from "@/components/ui/ToothDiagram";

interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
  email?: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface CaseItemRow {
  localId: string;
  productType: string;
  department: string;
  units: number;
  shade: string;
  material: string;
  notes: string;
  price: number;
}

type TabKey = "services" | "materials" | "notes" | "schedule";

const SERVICE_TREE: Record<string, string[]> = {
  Fixed: [
    "M20 - Stone Model",
    "Fixed Model/Implant",
    "PFM High Noble Yellow",
    "PFM High Noble White",
    "All Ceramic",
    "Crown",
    "Implant Crown",
    "Anterior Zirconia",
    "Posterior Zirconia",
    "Veneer Pressable",
    "Bridge Services",
    "Fixed Misc",
  ],
  Removable: [
    "Removable Model/Implant",
    "Denture",
    "Acrylic Partial",
    "Cast Partial",
    "FRS",
    "Repair/Reline/Misc",
  ],
  Ortho: ["Ortho Retainer", "Custom Tray", "Ortho Repair"],
  Implant: ["Full Arch Restoration", "Soft Tissue", "Implant Overdenture"],
  Shipping: ["UPS Second Day Air", "Local Delivery", "Shipping Fee"],
};

const CARRIERS = ["UPS Second Day Air", "UPS Ground", "FedEx Priority", "FedEx Ground", "Local Delivery", "Courier"];
const SHIP_TIMES = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const MATERIALS = ["None", "Zirconia", "E.max", "High Noble Yellow", "High Noble White", "Noble", "Base Metal", "Titanium", "Acrylic"];
const SHADE_SWATCHES = ["A1", "A2", "A3", "A3.5", "B1", "B2", "C1", "C2", "D2", "BL1", "BL2"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-300">{children}</label>;
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`h-9 w-full rounded border border-slate-600 bg-slate-950 px-2.5 text-sm text-white outline-none transition focus:border-sky-400 ${className}`}
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded border border-slate-600 bg-slate-950 px-2 text-sm text-white outline-none transition focus:border-sky-400"
    >
      {children}
    </select>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-700 bg-slate-900">
      <div className="flex h-9 items-center gap-2 border-b border-slate-700 bg-slate-800 px-3">
        <Icon className="h-4 w-4 text-sky-300" />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-100">{title}</h2>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-2 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-sky-500"
      />
      {label}
    </label>
  );
}

function makeItem(productType: string, department: string): CaseItemRow {
  return {
    localId: `${Date.now()}-${Math.random()}`,
    productType,
    department,
    units: 1,
    shade: "",
    material: "None",
    notes: "",
    price: 0,
  };
}

export default function NewCasePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [showAccountResults, setShowAccountResults] = useState(false);
  const [dentalAccountId, setDentalAccountId] = useState("");

  const [patientFirst, setPatientFirst] = useState("");
  const [patientMI, setPatientMI] = useState("");
  const [patientLast, setPatientLast] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");

  const [caseType, setCaseType] = useState<"NEW" | "REMAKE" | "REPAIR">("NEW");
  const [priority, setPriority] = useState<"NORMAL" | "RUSH" | "STAT">("NORMAL");
  const [rushOrder, setRushOrder] = useState(false);
  const [tryIn, setTryIn] = useState(false);
  const [tryInLeadDays, setTryInLeadDays] = useState("0");
  const [caseGuarantee, setCaseGuarantee] = useState(false);
  const [generateSchedule, setGenerateSchedule] = useState(true);

  const [pan, setPan] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [noDueDate, setNoDueDate] = useState(false);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("UPS Second Day Air");
  const [shippingTime, setShippingTime] = useState("4:00 PM");

  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [missingTeeth, setMissingTeeth] = useState<number[]>([]);
  const [caseItems, setCaseItems] = useState<CaseItemRow[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Fixed: true,
    Removable: true,
    Ortho: false,
    Implant: false,
    Shipping: false,
  });
  const [activeTab, setActiveTab] = useState<TabKey>("services");

  const [softTissueShade, setSoftTissueShade] = useState("");
  const [caseShade, setCaseShade] = useState("");
  const [metalSelection, setMetalSelection] = useState("None");
  const [materialsReceived, setMaterialsReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((response) => response.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]));
  }, []);

  const selectedAccount = accounts.find((account) => account.id === dentalAccountId) ?? null;

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return accounts.slice(0, 8);
    return accounts
      .filter(
        (account) =>
          account.name.toLowerCase().includes(query) ||
          (account.doctorName ?? "").toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [accountSearch, accounts]);

  const patientName = [patientFirst.trim(), patientMI.trim() ? `${patientMI.trim()}.` : "", patientLast.trim()]
    .filter(Boolean)
    .join(" ");

  const toothNumbers = useMemo(
    () => [...selectedTeeth].sort((a, b) => a - b).join(", "),
    [selectedTeeth]
  );

  const totalUnits = caseItems.reduce((sum, item) => sum + item.units, 0);
  const totalValue = caseItems.reduce((sum, item) => sum + item.units * item.price, 0);

  function selectAccount(account: DentalAccount) {
    setDentalAccountId(account.id);
    setAccountSearch(`${account.name}${account.doctorName ? ` - Dr. ${account.doctorName}` : ""}`);
    setShowAccountResults(false);
    const addressParts = [account.address, account.city, account.state, account.zip].filter(Boolean);
    if (addressParts.length) setShippingAddress(addressParts.join(", "));
  }

  function addItem(productType: string, department: string) {
    setCaseItems((items) => [...items, makeItem(productType, department)]);
    setActiveTab("services");
  }

  function updateItem(localId: string, patch: Partial<CaseItemRow>) {
    setCaseItems((items) => items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  }

  async function saveCase() {
    setError("");
    if (!dentalAccountId) {
      setError("Select a doctor/account before saving.");
      return;
    }
    if (!patientFirst.trim() || !patientLast.trim()) {
      setError("Patient first and last name are required.");
      return;
    }
    if (caseItems.length === 0) {
      setError("Add at least one service before saving.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientFirst: patientFirst.trim(),
          patientMI: patientMI.trim() || null,
          patientLast: patientLast.trim(),
          patientAge: patientAge ? Number(patientAge) : null,
          patientGender: patientGender || null,
          dentalAccountId,
          priority,
          caseType,
          caseOrigin: "LOCAL",
          route: shippingCarrier === "Local Delivery" ? "LOCAL" : "SHIP",
          rushOrder,
          tryIn,
          tryInLeadDays: tryIn ? Number(tryInLeadDays || 0) : null,
          caseGuarantee,
          receivedDate: receivedDate ? new Date(receivedDate).toISOString() : undefined,
          dueDate: !noDueDate && dueDate ? new Date(dueDate).toISOString() : null,
          pan: pan || null,
          shade: caseShade || null,
          softTissueShade: softTissueShade || null,
          metalSelection: metalSelection !== "None" ? metalSelection : null,
          selectedTeeth: selectedTeeth.length ? JSON.stringify(selectedTeeth) : null,
          missingTeeth: missingTeeth.length ? JSON.stringify(missingTeeth) : null,
          notes: notes || null,
          internalNotes: internalNotes || null,
          materialsReceived: materialsReceived || null,
          shippingAddress: shippingAddress || null,
          shippingCarrier: shippingCarrier || null,
          shippingTime: shippingTime || null,
          generateSchedule,
          _authorName: "Staff",
          items: caseItems.map((item) => ({
            productType: item.productType,
            toothNumbers: toothNumbers || null,
            units: item.units,
            shade: item.shade || caseShade || null,
            material: item.material !== "None" ? item.material : null,
            notes: item.notes || null,
            price: item.price,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Failed to save case.");
        return;
      }

      const created = await response.json();
      router.push(`/cases/${created.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-700 bg-slate-900 px-4">
        <Link href="/incoming" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Incoming
        </Link>
        <div className="h-5 w-px bg-slate-700" />
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-sky-300" />
          <div>
            <h1 className="text-sm font-bold text-white">New Case / Order Entry</h1>
            <p className="text-xs text-slate-400">{patientName || "No patient selected"}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {rushOrder && <span className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">RUSH</span>}
          <button
            type="button"
            onClick={saveCase}
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Case
          </button>
        </div>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-[1.25fr_1fr_300px]">
        <div className="space-y-3">
          <Panel title="Doctor" icon={UserRound}>
            <div className="grid gap-3 lg:grid-cols-[1fr_150px]">
              <div className="relative">
                <FieldLabel>Account / Doctor Search</FieldLabel>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      value={accountSearch}
                      onChange={(event) => {
                        setAccountSearch(event.target.value);
                        setShowAccountResults(true);
                      }}
                      onFocus={() => setShowAccountResults(true)}
                      className="h-9 w-full rounded border border-slate-600 bg-slate-950 pl-8 pr-2 text-sm text-white outline-none transition focus:border-sky-400"
                      placeholder="Doctor, practice, or account"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAccountResults(true)}
                    className="h-9 rounded bg-slate-700 px-3 text-sm font-semibold text-white hover:bg-slate-600"
                  >
                    Search
                  </button>
                </div>
                {showAccountResults && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border border-slate-600 bg-slate-950 shadow-xl">
                    {filteredAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => selectAccount(account)}
                        className="block w-full border-b border-slate-800 px-3 py-2 text-left hover:bg-slate-800"
                      >
                        <span className="block text-sm font-semibold text-white">{account.name}</span>
                        <span className="block text-xs text-slate-400">
                          {account.doctorName ? `Dr. ${account.doctorName}` : "No doctor listed"}
                        </span>
                      </button>
                    ))}
                    {filteredAccounts.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">No accounts found</p>}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Pan Number</FieldLabel>
                <TextInput value={pan} onChange={setPan} placeholder="Pan #" />
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_170px_170px]">
              <div>
                <FieldLabel>Ship To</FieldLabel>
                <TextInput value={shippingAddress} onChange={setShippingAddress} placeholder="Shipping address" />
              </div>
              <div>
                <FieldLabel>Carrier</FieldLabel>
                <SelectInput value={shippingCarrier} onChange={setShippingCarrier}>
                  {CARRIERS.map((carrier) => <option key={carrier}>{carrier}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Ship Time</FieldLabel>
                <SelectInput value={shippingTime} onChange={setShippingTime}>
                  {SHIP_TIMES.map((time) => <option key={time}>{time}</option>)}
                </SelectInput>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-800 pt-3">
              <Checkbox checked={rushOrder} onChange={(checked) => {
                setRushOrder(checked);
                setPriority(checked ? "RUSH" : "NORMAL");
              }} label="Rush Order" />
              <Checkbox checked={caseGuarantee} onChange={setCaseGuarantee} label="Case Guarantee" />
              <Checkbox checked={generateSchedule} onChange={setGenerateSchedule} label="Generate Schedule" />
              {selectedAccount?.phone && (
                <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                  <Phone className="h-4 w-4" />
                  {selectedAccount.phone}
                </span>
              )}
            </div>
          </Panel>

          <Panel title="Patient Details" icon={FileText}>
            <div className="grid gap-3 md:grid-cols-[1fr_72px_1fr_100px_180px]">
              <div>
                <FieldLabel>First Name</FieldLabel>
                <TextInput value={patientFirst} onChange={setPatientFirst} required />
              </div>
              <div>
                <FieldLabel>MI</FieldLabel>
                <TextInput value={patientMI} onChange={(value) => setPatientMI(value.slice(0, 1).toUpperCase())} className="text-center" />
              </div>
              <div>
                <FieldLabel>Last Name</FieldLabel>
                <TextInput value={patientLast} onChange={setPatientLast} required />
              </div>
              <div>
                <FieldLabel>Age</FieldLabel>
                <TextInput value={patientAge} onChange={setPatientAge} type="number" />
              </div>
              <div>
                <FieldLabel>Gender</FieldLabel>
                <div className="flex h-9 items-center gap-4">
                  {["MALE", "FEMALE"].map((gender) => (
                    <label key={gender} className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="radio"
                        name="gender"
                        checked={patientGender === gender}
                        onChange={() => setPatientGender(gender)}
                        className="accent-sky-500"
                      />
                      {gender === "MALE" ? "Male" : "Female"}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Order Details" icon={Truck}>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
              <div>
                <FieldLabel>Case Type</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["NEW", "New"],
                    ["REMAKE", "Remake"],
                    ["REPAIR", "Repair"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCaseType(value as "NEW" | "REMAKE" | "REPAIR")}
                      className={`h-9 rounded border text-sm font-semibold ${
                        caseType === value
                          ? "border-sky-400 bg-sky-600 text-white"
                          : "border-slate-600 bg-slate-950 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Received Date</FieldLabel>
                <TextInput value={receivedDate} onChange={setReceivedDate} type="date" />
              </div>
              <div>
                <FieldLabel>Delivery Due Date</FieldLabel>
                <div className="flex gap-2">
                  <TextInput value={dueDate} onChange={setDueDate} type="date" className={noDueDate ? "opacity-50" : ""} />
                  <label className="flex h-9 items-center gap-1 whitespace-nowrap text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={noDueDate}
                      onChange={(event) => {
                        setNoDueDate(event.target.checked);
                        if (event.target.checked) setDueDate("");
                      }}
                      className="accent-sky-500"
                    />
                    No due
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[160px_160px_1fr]">
              <div>
                <FieldLabel>Priority</FieldLabel>
                <SelectInput value={priority} onChange={(value) => setPriority(value as "NORMAL" | "RUSH" | "STAT")}>
                  <option value="NORMAL">Normal</option>
                  <option value="RUSH">Rush</option>
                  <option value="STAT">Stat</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Try In Lead</FieldLabel>
                <TextInput value={tryInLeadDays} onChange={setTryInLeadDays} type="number" />
              </div>
              <div className="flex items-end gap-4">
                <Checkbox checked={tryIn} onChange={setTryIn} label="Try In Required" />
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <section className="border border-slate-700 bg-slate-900">
            <div className="flex h-9 items-center border-b border-slate-700 bg-slate-800">
              {[
                ["services", "Services"],
                ["materials", "Material Received"],
                ["notes", "Notes"],
                ["schedule", "View Schedule"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as TabKey)}
                  className={`h-full border-r border-slate-700 px-3 text-xs font-bold ${
                    activeTab === key ? "bg-yellow-300 text-slate-950" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "services" && (
              <div className="grid min-h-[430px] grid-cols-[230px_1fr]">
                <div className="border-r border-slate-700 bg-slate-950">
                  <div className="border-b border-slate-800 p-2">
                    <FieldLabel>Type Product #</FieldLabel>
                    <TextInput value="" onChange={() => undefined} placeholder="Search services" />
                  </div>
                  <div className="max-h-[390px] overflow-auto">
                    {Object.entries(SERVICE_TREE).map(([department, products]) => {
                      const open = expandedGroups[department];
                      return (
                        <div key={department}>
                          <button
                            type="button"
                            onClick={() => setExpandedGroups((groups) => ({ ...groups, [department]: !open }))}
                            className="flex w-full items-center gap-1 border-b border-slate-800 bg-slate-900 px-2 py-1.5 text-left text-xs font-bold text-yellow-200"
                          >
                            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {department}
                          </button>
                          {open && products.map((product) => (
                            <button
                              key={product}
                              type="button"
                              onClick={() => addItem(product, department)}
                              className="flex w-full items-center gap-2 border-b border-slate-900 px-5 py-1.5 text-left text-xs text-slate-300 hover:bg-sky-950 hover:text-white"
                            >
                              <Plus className="h-3 w-3 text-slate-500" />
                              <span className="truncate">{product}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-3">
                  <div className="mb-3 grid grid-cols-[1fr_60px_90px_100px_90px_36px] gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <span>Service</span>
                    <span>Qty</span>
                    <span>Shade</span>
                    <span>Material</span>
                    <span>Price</span>
                    <span />
                  </div>
                  <div className="space-y-2">
                    {caseItems.map((item) => (
                      <div key={item.localId} className="grid grid-cols-[1fr_60px_90px_100px_90px_36px] gap-2">
                        <TextInput value={item.productType} onChange={(value) => updateItem(item.localId, { productType: value })} />
                        <TextInput value={String(item.units)} onChange={(value) => updateItem(item.localId, { units: Math.max(1, Number(value) || 1) })} type="number" />
                        <TextInput value={item.shade} onChange={(value) => updateItem(item.localId, { shade: value })} />
                        <SelectInput value={item.material} onChange={(value) => updateItem(item.localId, { material: value })}>
                          {MATERIALS.map((material) => <option key={material}>{material}</option>)}
                        </SelectInput>
                        <TextInput value={String(item.price)} onChange={(value) => updateItem(item.localId, { price: Number(value) || 0 })} type="number" />
                        <button
                          type="button"
                          onClick={() => setCaseItems((items) => items.filter((candidate) => candidate.localId !== item.localId))}
                          className="flex h-9 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {caseItems.length === 0 && (
                    <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-slate-500">
                      <PackagePlus className="mb-2 h-8 w-8" />
                      <p className="text-sm">Select a service from the left panel.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "materials" && (
              <div className="grid min-h-[430px] gap-3 p-3 lg:grid-cols-2">
                <div>
                  <FieldLabel>Material Received</FieldLabel>
                  <textarea
                    value={materialsReceived}
                    onChange={(event) => setMaterialsReceived(event.target.value)}
                    className="h-40 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                    placeholder="Models, impressions, scans, analogs, bites..."
                  />
                </div>
                <div>
                  <FieldLabel>Metal Selection</FieldLabel>
                  <SelectInput value={metalSelection} onChange={setMetalSelection}>
                    {MATERIALS.map((material) => <option key={material}>{material}</option>)}
                  </SelectInput>
                  <FieldLabel>Soft Tissue Shade</FieldLabel>
                  <TextInput value={softTissueShade} onChange={setSoftTissueShade} />
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="grid min-h-[430px] gap-3 p-3 lg:grid-cols-2">
                <div>
                  <FieldLabel>Doctor / Case Notes</FieldLabel>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="h-80 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <FieldLabel>Internal Notes</FieldLabel>
                  <textarea
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                    className="h-80 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                  />
                </div>
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="min-h-[430px] p-3">
                <div className="grid gap-2 text-sm text-slate-300">
                  {["Scan", "Design", "Milling", "C&B QC", "Stain & Glaze", "Final QC", "Shipping"].map((step, index) => (
                    <div key={step} className="grid grid-cols-[40px_1fr_120px] items-center border border-slate-700 bg-slate-950 px-3 py-2">
                      <span className="text-slate-500">{index + 1}</span>
                      <span>{step}</span>
                      <span className="text-xs text-slate-500">Scheduled</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-3">
          <Panel title="Delivery Due Date" icon={CalendarDays}>
            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="flex items-center gap-2 text-sm text-white">
                <CalendarDays className="h-4 w-4 text-sky-300" />
                {noDueDate ? "No due date" : dueDate || "No date selected"}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Ship time {shippingTime}
              </div>
            </div>
          </Panel>

          <Panel title="Tooth Selection" icon={FlaskConical}>
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => setSelectedTeeth(Array.from({ length: 16 }, (_, index) => index + 1))} className="h-8 rounded bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600">All Upper</button>
              <button type="button" onClick={() => setSelectedTeeth(Array.from({ length: 16 }, (_, index) => index + 17))} className="h-8 rounded bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600">All Lower</button>
              <button type="button" onClick={() => { setSelectedTeeth([]); setMissingTeeth([]); }} className="h-8 rounded bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600">Clear</button>
            </div>
            <ToothDiagram selected={selectedTeeth} missing={missingTeeth} onChange={(selected, missing) => { setSelectedTeeth(selected); setMissingTeeth(missing); }} />
          </Panel>

          <Panel title="Shade Color" icon={ShieldCheck}>
            <div className="grid grid-cols-4 gap-2">
              {SHADE_SWATCHES.map((shade) => (
                <button
                  key={shade}
                  type="button"
                  onClick={() => setCaseShade(shade)}
                  className={`h-8 rounded border text-xs font-bold ${
                    caseShade === shade ? "border-sky-300 bg-sky-600 text-white" : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {shade}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <FieldLabel>Custom Shade</FieldLabel>
              <TextInput value={caseShade} onChange={setCaseShade} placeholder="e.g. A2, BL1" />
            </div>
          </Panel>

          <Panel title="Order Summary" icon={Check}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Services</span><span>{caseItems.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Units</span><span>{totalUnits}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Teeth</span><span>{selectedTeeth.length}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold"><span>Total</span><span>${totalValue.toFixed(2)}</span></div>
            </div>
          </Panel>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-xl">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
