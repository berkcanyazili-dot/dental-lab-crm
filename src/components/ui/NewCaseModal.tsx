"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import ToothDiagram from "@/components/ui/ToothDiagram";

interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface Technician {
  id: string;
  name: string;
}

interface CaseItemInput {
  localId: string;
  productType: string;
  department: string;
  units: number;
  shade: string;
  material: string;
  price: number;
}

interface Props {
  defaultStatus?: string;
  onClose: () => void;
  onSaved: () => void;
}

type CaseType = "NEW" | "REMAKE" | "REPAIR";
type Priority = "NORMAL" | "RUSH" | "STAT";
type TabKey = "services" | "materials" | "notes";

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
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded border border-slate-600 bg-slate-950 px-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <select
      value={value}
      required={required}
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
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-100">{title}</h3>
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

function makeItem(productType: string, department: string): CaseItemInput {
  return {
    localId: `${Date.now()}-${Math.random()}`,
    productType,
    department,
    units: 1,
    shade: "",
    material: "None",
    price: 0,
  };
}

export default function NewCaseModal({ onClose, onSaved }: Props) {
  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [showAccountResults, setShowAccountResults] = useState(false);
  const [dentalAccountId, setDentalAccountId] = useState("");
  const [technicianId, setTechnicianId] = useState("");

  const [patientFirst, setPatientFirst] = useState("");
  const [patientMI, setPatientMI] = useState("");
  const [patientLast, setPatientLast] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");

  const [caseType, setCaseType] = useState<CaseType>("NEW");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [rushOrder, setRushOrder] = useState(false);
  const [tryIn, setTryIn] = useState(false);
  const [tryInLeadDays, setTryInLeadDays] = useState("0");
  const [caseGuarantee, setCaseGuarantee] = useState(false);
  const [generateSchedule, setGenerateSchedule] = useState(true);

  const [pan, setPan] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("UPS Second Day Air");
  const [shippingTime, setShippingTime] = useState("4:00 PM");

  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [missingTeeth, setMissingTeeth] = useState<number[]>([]);
  const [items, setItems] = useState<CaseItemInput[]>([makeItem("Crown", "Fixed")]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Fixed: true,
    Removable: false,
    Ortho: false,
    Implant: false,
    Shipping: false,
  });
  const [activeTab, setActiveTab] = useState<TabKey>("services");

  const [caseShade, setCaseShade] = useState("");
  const [softTissueShade, setSoftTissueShade] = useState("");
  const [metalSelection, setMetalSelection] = useState("None");
  const [materialsReceived, setMaterialsReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((response) => response.json()),
      fetch("/api/technicians").then((response) => response.json()),
    ])
      .then(([accountData, technicianData]) => {
        setAccounts(Array.isArray(accountData) ? accountData : []);
        setTechnicians(Array.isArray(technicianData) ? technicianData : []);
      })
      .catch(() => {
        setAccounts([]);
        setTechnicians([]);
      });
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
  const toothNumbers = useMemo(() => [...selectedTeeth].sort((a, b) => a - b).join(", "), [selectedTeeth]);
  const totalUnits = items.reduce((sum, item) => sum + item.units, 0);
  const totalValue = items.reduce((sum, item) => sum + item.units * item.price, 0);

  function selectAccount(account: DentalAccount) {
    setDentalAccountId(account.id);
    setAccountSearch(`${account.name}${account.doctorName ? ` - Dr. ${account.doctorName}` : ""}`);
    setShowAccountResults(false);
    const addressParts = [account.address, account.city, account.state, account.zip].filter(Boolean);
    if (addressParts.length) setShippingAddress(addressParts.join(", "));
  }

  function updateItem(localId: string, patch: Partial<CaseItemInput>) {
    setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!dentalAccountId) {
      setError("Select a doctor/account before saving.");
      return;
    }
    if (!patientFirst.trim() || !patientLast.trim()) {
      setError("Patient first and last name are required.");
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
          technicianId: technicianId || null,
          priority,
          caseType,
          caseOrigin: "LOCAL",
          route: shippingCarrier === "Local Delivery" ? "LOCAL" : "SHIP",
          rushOrder,
          tryIn,
          tryInLeadDays: tryIn ? Number(tryInLeadDays || 0) : null,
          caseGuarantee,
          receivedDate: receivedDate ? new Date(receivedDate).toISOString() : undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
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
          items: items.map((item) => ({
            productType: item.productType,
            toothNumbers: toothNumbers || null,
            units: item.units,
            shade: item.shade || caseShade || null,
            material: item.material !== "None" ? item.material : null,
            notes: item.department,
            price: item.price,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Case could not be created.");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-slate-700 bg-slate-900 px-5">
          <div>
            <h2 className="text-base font-bold text-white">New Case / Order</h2>
            <p className="text-xs text-slate-400">{patientName || "Patient not entered"} {selectedAccount ? `- ${selectedAccount.name}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="new-case-order-form"
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create Case
            </button>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form id="new-case-order-form" onSubmit={handleSubmit} className="overflow-auto p-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_370px]">
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
                <Panel title="Doctor" icon={UserRound}>
                  <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                    <div className="relative">
                      <FieldLabel>Acct Num / Doctor</FieldLabel>
                      <div className="flex gap-2">
                        <TextInput
                          value={accountSearch}
                          onChange={(value) => {
                            setAccountSearch(value);
                            setShowAccountResults(true);
                          }}
                          placeholder="Search account or doctor"
                          required
                        />
                        <button type="button" className="flex h-9 w-10 items-center justify-center rounded border border-slate-600 bg-slate-800 text-slate-300">
                          <Search className="h-4 w-4" />
                        </button>
                      </div>
                      {showAccountResults && filteredAccounts.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-slate-700 bg-slate-950 shadow-xl">
                          {filteredAccounts.map((account) => (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => selectAccount(account)}
                              className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-sky-950"
                            >
                              <span className="font-semibold">{account.name}</span>
                              {account.doctorName && <span className="text-slate-400"> - Dr. {account.doctorName}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <FieldLabel>Technician</FieldLabel>
                      <SelectInput value={technicianId} onChange={setTechnicianId}>
                        <option value="">Unassigned</option>
                        {technicians.map((technician) => (
                          <option key={technician.id} value={technician.id}>{technician.name}</option>
                        ))}
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Ship To</FieldLabel>
                      <TextInput value={shippingAddress} onChange={setShippingAddress} placeholder="Shipping address" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                  </div>
                </Panel>

                <Panel title="Order Details" icon={ClipboardList}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>Case Type</FieldLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {(["NEW", "REMAKE", "REPAIR"] as CaseType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setCaseType(type)}
                            className={`h-9 rounded border text-xs font-bold ${caseType === type ? "border-sky-300 bg-sky-600 text-white" : "border-slate-700 bg-slate-950 text-slate-300"}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Priority</FieldLabel>
                      <SelectInput value={priority} onChange={(value) => setPriority(value as Priority)}>
                        <option value="NORMAL">NORMAL</option>
                        <option value="RUSH">RUSH</option>
                        <option value="STAT">STAT</option>
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Received Date</FieldLabel>
                      <TextInput value={receivedDate} onChange={setReceivedDate} type="date" />
                    </div>
                    <div>
                      <FieldLabel>Delivery Due Date</FieldLabel>
                      <TextInput value={dueDate} onChange={setDueDate} type="date" />
                    </div>
                    <div>
                      <FieldLabel>Pan Number</FieldLabel>
                      <TextInput value={pan} onChange={setPan} />
                    </div>
                    <div>
                      <FieldLabel>Try-In Lead Days</FieldLabel>
                      <TextInput value={tryInLeadDays} onChange={setTryInLeadDays} type="number" />
                    </div>
                    <div className="col-span-full grid grid-cols-2 gap-x-4 md:grid-cols-4">
                      <Checkbox checked={rushOrder} onChange={setRushOrder} label="Rush Order" />
                      <Checkbox checked={tryIn} onChange={setTryIn} label="Try-In Required" />
                      <Checkbox checked={caseGuarantee} onChange={setCaseGuarantee} label="Guarantee" />
                      <Checkbox checked={generateSchedule} onChange={setGenerateSchedule} label="Schedule" />
                    </div>
                  </div>
                </Panel>
              </div>

              <Panel title="Patient Details" icon={FileText}>
                <div className="grid gap-3 md:grid-cols-[1fr_80px_1fr_90px_130px]">
                  <div>
                    <FieldLabel>First Name</FieldLabel>
                    <TextInput value={patientFirst} onChange={setPatientFirst} required />
                  </div>
                  <div>
                    <FieldLabel>MI</FieldLabel>
                    <TextInput value={patientMI} onChange={setPatientMI} />
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
                    <SelectInput value={patientGender} onChange={setPatientGender}>
                      <option value="">Unknown</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </SelectInput>
                  </div>
                </div>
              </Panel>

              <section className="border border-slate-700 bg-slate-900">
                <div className="flex h-10 items-center border-b border-slate-700 bg-slate-800">
                  {[
                    ["services", "Services"],
                    ["materials", "Material Received"],
                    ["notes", "Notes"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key as TabKey)}
                      className={`h-full border-r border-slate-700 px-4 text-xs font-bold ${activeTab === key ? "bg-yellow-400 text-slate-950" : "text-slate-300 hover:bg-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeTab === "services" && (
                  <div className="grid min-h-[360px] lg:grid-cols-[230px_1fr]">
                    <div className="border-r border-slate-700 bg-slate-950">
                      <div className="border-b border-slate-800 p-2">
                        <FieldLabel>Type Product #</FieldLabel>
                        <TextInput value="" onChange={() => undefined} placeholder="Search services" />
                      </div>
                      <div className="max-h-[320px] overflow-auto">
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
                                  onClick={() => setItems((current) => [...current, makeItem(product, department)])}
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
                      <div className="mb-2 grid grid-cols-[1fr_52px_82px_112px_78px_34px] gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        <span>Service</span>
                        <span>Qty</span>
                        <span>Shade</span>
                        <span>Material</span>
                        <span>Price</span>
                        <span />
                      </div>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.localId} className="grid grid-cols-[1fr_52px_82px_112px_78px_34px] gap-2">
                            <TextInput value={item.productType} onChange={(value) => updateItem(item.localId, { productType: value })} />
                            <TextInput value={String(item.units)} onChange={(value) => updateItem(item.localId, { units: Math.max(1, Number(value) || 1) })} type="number" />
                            <TextInput value={item.shade} onChange={(value) => updateItem(item.localId, { shade: value })} />
                            <SelectInput value={item.material} onChange={(value) => updateItem(item.localId, { material: value })}>
                              {MATERIALS.map((material) => <option key={material}>{material}</option>)}
                            </SelectInput>
                            <TextInput value={String(item.price)} onChange={(value) => updateItem(item.localId, { price: Number(value) || 0 })} type="number" />
                            <button
                              type="button"
                              onClick={() => setItems((current) => current.filter((candidate) => candidate.localId !== item.localId))}
                              disabled={items.length === 1}
                              className="flex h-9 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300 disabled:opacity-30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "materials" && (
                  <div className="grid min-h-[360px] gap-3 p-3 lg:grid-cols-2">
                    <div>
                      <FieldLabel>Material Received</FieldLabel>
                      <textarea
                        value={materialsReceived}
                        onChange={(event) => setMaterialsReceived(event.target.value)}
                        className="h-40 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                        placeholder="Models, impressions, scans, analogs, bites..."
                      />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <FieldLabel>Metal Selection</FieldLabel>
                        <SelectInput value={metalSelection} onChange={setMetalSelection}>
                          {MATERIALS.map((material) => <option key={material}>{material}</option>)}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Soft Tissue Shade</FieldLabel>
                        <TextInput value={softTissueShade} onChange={setSoftTissueShade} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="grid min-h-[360px] gap-3 p-3 lg:grid-cols-2">
                    <div>
                      <FieldLabel>Doctor / Case Notes</FieldLabel>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="h-72 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <FieldLabel>Internal Notes</FieldLabel>
                      <textarea
                        value={internalNotes}
                        onChange={(event) => setInternalNotes(event.target.value)}
                        className="h-72 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-3">
              <Panel title="Tooth Selection" icon={FlaskConical}>
                <div className="mb-3 flex flex-wrap gap-2">
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
                      className={`h-8 rounded border text-xs font-bold ${caseShade === shade ? "border-sky-300 bg-sky-600 text-white" : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"}`}
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

              <Panel title="Delivery" icon={CalendarDays}>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between"><span className="text-slate-400">Due</span><span>{dueDate || "Not set"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Ship</span><span>{shippingTime}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Carrier</span><span>{shippingCarrier}</span></div>
                </div>
              </Panel>

              <Panel title="Order Summary" icon={PackagePlus}>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between"><span className="text-slate-400">Services</span><span>{items.length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Units</span><span>{totalUnits}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Teeth</span><span>{selectedTeeth.length}</span></div>
                  <div className="flex justify-between border-t border-slate-700 pt-2 font-bold text-white"><span>Total</span><span>${totalValue.toFixed(2)}</span></div>
                </div>
              </Panel>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
