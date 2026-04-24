"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Phone,
  Truck,
  User,
  Building2,
  FileText,
  Hash,
  Package,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Zap,
} from "lucide-react";
import ToothDiagram from "@/components/ui/ToothDiagram";

/* ─── Types ──────────────────────────────────────────────────── */
interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
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
  metalSelection: string;
  toothType: string;
  price: number;
}

/* ─── Constants ──────────────────────────────────────────────── */
const CARRIERS = [
  "UPS Ground",
  "UPS 2nd Day Air",
  "FedEx Ground",
  "FedEx Priority",
  "Local Delivery",
  "Special Courier",
];

const SHIP_TIMES = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

const CASE_ORIGINS = ["Local", "iTero Web Service", "3Shape", "Mail"];

const SERVICE_TREE: Record<string, string[]> = {
  Fixed:     ["Stone Model", "Crown", "Implant Crown", "Full Arch Restoration", "Anterior Zirconia", "Posterior Zirconia", "PFM High Noble Yellow", "PFM High Noble White", "Veneer Pressable", "Full Case Unlimited", "Bridge", "Fixed Misc"],
  Removable: ["Denture", "Acrylic Partial", "Cast Partial", "FRS", "Repair/Reline/Misc"],
  Ortho:     ["Ortho Retainer", "Custom Retainer", "Ortho Repair"],
  Implant:   ["Custom Tray", "Soft Tissue", "Implant Overdenture"],
};

const METAL_OPTIONS = ["None", "High Noble Yellow", "High Noble White", "Noble", "Base Metal", "Titanium", "Zirconia"];

/* ─── Shared form field components ───────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
      {children}
    </span>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  className = "",
  type = "text",
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors ${className}`}
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
        <Icon className="w-4 h-4 text-sky-400" />
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
  accent = "sky",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  accent?: "sky" | "red" | "green";
}) {
  const ring = accent === "red" ? "accent-red-500" : accent === "green" ? "accent-green-500" : "accent-sky-500";
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-4 h-4 rounded ${ring} bg-gray-700 border-gray-600`}
      />
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function NewCasePage() {
  const router = useRouter();

  /* accounts */
  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DentalAccount[]>([]);
  const [showSearchDrop, setShowSearchDrop] = useState(false);

  /* ── form state ── */
  const [dentalAccountId, setDentalAccountId] = useState("");
  const [callRequested, setCallRequested] = useState(false);

  /* shipping */
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [shippingTime, setShippingTime] = useState("");
  const [rushOrder, setRushOrder] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [noDueDate, setNoDueDate] = useState(false);

  /* patient */
  const [patientFirst, setPatientFirst] = useState("");
  const [patientMI, setPatientMI] = useState("");
  const [patientLast, setPatientLast] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientAppointment, setPatientAppointment] = useState("");

  /* case type */
  const [caseType, setCaseType] = useState("NEW");
  const [pan, setPan] = useState("");
  const [originalRxDue, setOriginalRxDue] = useState("");
  const [noOriginalRxDue, setNoOriginalRxDue] = useState(false);
  const [caseGuarantee, setCaseGuarantee] = useState(false);
  const [noGuarantee, setNoGuarantee] = useState(false);
  const [caseOrigin, setCaseOrigin] = useState("Local");

  /* services */
  const [caseItems, setCaseItems] = useState<CaseItemRow[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    Fixed: true, Removable: false, Ortho: false, Implant: false,
  });
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [missingTeeth, setMissingTeeth] = useState<number[]>([]);

  /* submission */
  const [generateSchedule, setGenerateSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* ── load accounts ── */
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(Array.isArray(d) ? d : []));
  }, []);

  /* ── account search ── */
  const runSearch = useCallback(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) {
      setSearchResults(accounts);
    } else {
      setSearchResults(
        accounts.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.doctorName ?? "").toLowerCase().includes(q)
        )
      );
    }
    setShowSearchDrop(true);
  }, [accountSearch, accounts]);

  const selectAccount = (acc: DentalAccount) => {
    setDentalAccountId(acc.id);
    setAccountSearch(`${acc.name}${acc.doctorName ? ` — Dr. ${acc.doctorName}` : ""}`);
    setShowSearchDrop(false);
    /* auto-fill shipping address */
    const parts = [acc.address, acc.city, acc.state, acc.zip].filter(Boolean);
    if (parts.length) setShippingAddress(parts.join(", "));
  };

  /* ── derived ── */
  const selectedAccount = accounts.find((a) => a.id === dentalAccountId) ?? null;

  /* ── patient full name for header preview ── */
  const patientPreview =
    [patientFirst, patientMI ? `${patientMI}.` : null, patientLast]
      .filter(Boolean)
      .join(" ") || "New Patient";

  /* ── item helpers ── */
  const addItem = (productType: string, department: string) => {
    setCaseItems((prev) => [
      ...prev,
      { localId: `${Date.now()}-${Math.random()}`, productType, department, units: 1, shade: "", metalSelection: "None", toothType: "", price: 0 },
    ]);
  };
  const removeItem = (localId: string) =>
    setCaseItems((prev) => prev.filter((i) => i.localId !== localId));
  const updateItem = (localId: string, field: keyof CaseItemRow, value: string | number) =>
    setCaseItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, [field]: value } : i))
    );

  /* ── save ── */
  const handleSave = async (asDraft = false) => {
    setError("");
    if (!dentalAccountId) { setError("Please select a doctor / account."); return; }
    if (!patientFirst.trim() || !patientLast.trim()) { setError("Patient first and last name are required."); return; }
    setSaving(true);
    try {
      const patientName = [patientFirst.trim(), patientMI ? `${patientMI}.` : null, patientLast.trim()].filter(Boolean).join(" ");
      const teethStr = selectedTeeth.length > 0 ? [...selectedTeeth].sort((a, b) => a - b).join(", ") : null;
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientFirst: patientFirst.trim(),
          patientMI: patientMI || null,
          patientLast: patientLast.trim(),
          patientAge: patientAge ? parseInt(patientAge) : null,
          patientGender: patientGender || null,
          dentalAccountId,
          shippingAddress: shippingAddress || null,
          shippingCarrier: shippingCarrier || null,
          shippingTime: shippingTime || null,
          rushOrder,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          caseType,
          pan: pan || null,
          caseGuarantee,
          caseOrigin,
          priority: rushOrder ? "RUSH" : "NORMAL",
          status: asDraft ? "INCOMING" : "INCOMING",
          selectedTeeth: JSON.stringify(selectedTeeth),
          missingTeeth: JSON.stringify(missingTeeth),
          generateSchedule,
          _authorName: "Staff",
          items: caseItems.map((item) => ({
            productType: item.productType,
            toothNumbers: teethStr,
            units: item.units,
            shade: item.shade || null,
            material: item.metalSelection !== "None" ? item.metalSelection : null,
            notes: item.toothType || null,
            price: item.price,
          })),
        }),
      });
      if (res.ok) {
        const newCase = await res.json();
        router.push(`/cases/${newCase.id}`);
      } else {
        setError("Failed to save case. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-24">

      {/* ── Sticky top header ── */}
      <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link
          href="/incoming"
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel
        </Link>
        <div className="h-4 w-px bg-gray-700" />
        <div>
          <span className="text-white font-semibold text-sm">New Case</span>
          {patientFirst && (
            <span className="text-gray-500 text-sm ml-2">— {patientPreview}</span>
          )}
        </div>
        {rushOrder && (
          <span className="ml-2 text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
            RUSH
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-3.5 h-3.5" />
          Fill in all required fields before saving
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* ══════════════ ROW 1: Doctor + Shipping ══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Doctor / Account ── */}
          <SectionCard icon={Building2} title="Doctor / Account">
            {/* Search row */}
            <div className="mb-4">
              <Label>Search by Account Name or Doctor</Label>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={(e) => {
                        setAccountSearch(e.target.value);
                        if (!e.target.value) {
                          setDentalAccountId("");
                          setShowSearchDrop(false);
                        }
                      }}
                      onKeyDown={(e) => e.key === "Enter" && runSearch()}
                      placeholder="Type name or doctor…"
                      className="w-full pl-3 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={runSearch}
                    className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                </div>

                {/* Search dropdown */}
                {showSearchDrop && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                    {searchResults.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => selectAccount(acc)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                      >
                        <p className="text-sm font-medium text-white">{acc.name}</p>
                        {acc.doctorName && (
                          <p className="text-xs text-gray-500">Dr. {acc.doctorName}</p>
                        )}
                        {(acc.city || acc.state) && (
                          <p className="text-xs text-gray-600">
                            {[acc.city, acc.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {showSearchDrop && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl px-4 py-4">
                    <p className="text-sm text-gray-500 text-center">No accounts found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Doctor dropdown */}
            <div className="mb-4">
              <Label>Doctor / Account *</Label>
              <SelectInput
                value={dentalAccountId}
                onChange={(v) => {
                  setDentalAccountId(v);
                  const acc = accounts.find((a) => a.id === v);
                  if (acc) {
                    setAccountSearch(`${acc.name}${acc.doctorName ? ` — Dr. ${acc.doctorName}` : ""}`);
                    const parts = [acc.address, acc.city, acc.state, acc.zip].filter(Boolean);
                    if (parts.length) setShippingAddress(parts.join(", "));
                  }
                }}
              >
                <option value="">— Select account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.doctorName ? ` — Dr. ${a.doctorName}` : ""}
                  </option>
                ))}
              </SelectInput>
            </div>

            {/* Selected account info */}
            {selectedAccount && (
              <div className="mb-4 px-3 py-2.5 bg-gray-900/60 border border-gray-700/40 rounded-lg">
                <p className="text-sm font-medium text-white">{selectedAccount.name}</p>
                {selectedAccount.doctorName && (
                  <p className="text-xs text-gray-400 mt-0.5">Dr. {selectedAccount.doctorName}</p>
                )}
                {selectedAccount.phone && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedAccount.phone}
                  </p>
                )}
              </div>
            )}

            {/* Call requested */}
            <CheckboxField
              checked={callRequested}
              onChange={setCallRequested}
              label="Call Requested"
              accent="sky"
            />
          </SectionCard>

          {/* ── Shipping ── */}
          <SectionCard icon={Truck} title="Shipping">
            <div className="space-y-4">
              <div>
                <Label>Shipping Address</Label>
                <TextInput
                  value={shippingAddress}
                  onChange={setShippingAddress}
                  placeholder="Auto-filled from account, or enter manually…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Carrier</Label>
                  <SelectInput value={shippingCarrier} onChange={setShippingCarrier}>
                    <option value="">— Select —</option>
                    {CARRIERS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <Label>Ship Time</Label>
                  <SelectInput value={shippingTime} onChange={setShippingTime}>
                    <option value="">— Select —</option>
                    {SHIP_TIMES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div>
                <Label>Required Out of Lab By</Label>
                <TextInput
                  type="datetime-local"
                  value={dueDate}
                  onChange={setDueDate}
                />
                <div className="mt-2">
                  <CheckboxField
                    checked={noDueDate}
                    onChange={(v) => {
                      setNoDueDate(v);
                      if (v) setDueDate("");
                    }}
                    label="No Due Date"
                  />
                </div>
              </div>

              <div className="pt-1">
                <CheckboxField
                  checked={rushOrder}
                  onChange={setRushOrder}
                  label="Rush Order"
                  accent="red"
                />
                {rushOrder && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This case will be flagged as RUSH priority
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ══════════════ ROW 2: Patient + Case Type ══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Patient ── */}
          <SectionCard icon={User} title="Patient">
            <div className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Label>First Name *</Label>
                  <TextInput
                    value={patientFirst}
                    onChange={setPatientFirst}
                    placeholder="First"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label>MI</Label>
                  <TextInput
                    value={patientMI}
                    onChange={(v) => setPatientMI(v.slice(0, 1).toUpperCase())}
                    placeholder="M"
                    className="text-center"
                  />
                </div>
                <div className="col-span-5">
                  <Label>Last Name *</Label>
                  <TextInput
                    value={patientLast}
                    onChange={setPatientLast}
                    placeholder="Last"
                    required
                  />
                </div>
              </div>

              {/* Age + Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Age</Label>
                  <TextInput
                    type="number"
                    value={patientAge}
                    onChange={setPatientAge}
                    placeholder="e.g. 42"
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <div className="flex gap-4 mt-2">
                    {[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                    ].map(({ value, label }) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <input
                          type="radio"
                          name="patientGender"
                          value={value}
                          checked={patientGender === value}
                          onChange={() => setPatientGender(value)}
                          className="accent-sky-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Appointment date */}
              <div>
                <Label>Patient Appointment Date</Label>
                <TextInput
                  type="datetime-local"
                  value={patientAppointment}
                  onChange={setPatientAppointment}
                />
              </div>
            </div>
          </SectionCard>

          {/* ── Case Type ── */}
          <SectionCard icon={FileText} title="Case Type & Origin">
            <div className="space-y-4">

              {/* Case type radios */}
              <div>
                <Label>Case Type *</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {["NEW", "CONTINUATION", "REMAKE", "REPAIR"].map((type) => {
                    const labels: Record<string, string> = {
                      NEW: "New",
                      CONTINUATION: "Continuation",
                      REMAKE: "Remake",
                      REPAIR: "Repair",
                    };
                    const active = caseType === type;
                    return (
                      <label
                        key={type}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                          active
                            ? "bg-sky-600/20 border-sky-500/50 text-sky-300"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="caseType"
                          value={type}
                          checked={active}
                          onChange={() => setCaseType(type)}
                          className="accent-sky-500 w-3.5 h-3.5"
                        />
                        <span className="text-sm font-medium">{labels[type]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Pan number */}
              <div>
                <Label>Pan Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="Pan or model number"
                    className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Original RX due date */}
              <div>
                <Label>Original RX Due Date</Label>
                <TextInput
                  type="date"
                  value={originalRxDue}
                  onChange={setOriginalRxDue}
                />
                <div className="mt-2">
                  <CheckboxField
                    checked={noOriginalRxDue}
                    onChange={(v) => {
                      setNoOriginalRxDue(v);
                      if (v) setOriginalRxDue("");
                    }}
                    label="No Due Date"
                  />
                </div>
              </div>

              {/* Guarantees */}
              <div className="flex gap-4">
                <CheckboxField
                  checked={caseGuarantee}
                  onChange={(v) => {
                    setCaseGuarantee(v);
                    if (v) setNoGuarantee(false);
                  }}
                  label="Case Guarantee"
                  accent="green"
                />
                <CheckboxField
                  checked={noGuarantee}
                  onChange={(v) => {
                    setNoGuarantee(v);
                    if (v) setCaseGuarantee(false);
                  }}
                  label="No Guarantee"
                  accent="red"
                />
              </div>

              {/* Case origin */}
              <div>
                <Label>Case Origin</Label>
                <SelectInput value={caseOrigin} onChange={setCaseOrigin}>
                  {CASE_ORIGINS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </SelectInput>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ══════════════ SERVICES ══════════════ */}
        <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700/50">
            <Package className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Services</h2>
            {caseItems.length > 0 && (
              <span className="ml-2 text-xs bg-sky-600/30 text-sky-400 px-2.5 py-0.5 rounded-full font-medium">
                {caseItems.length} item{caseItems.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Tree + items two-panel */}
          <div className="flex min-h-[380px]">

            {/* Left: department tree */}
            <div className="w-56 flex-shrink-0 border-r border-gray-700/50 bg-gray-900/30 overflow-y-auto">
              {Object.entries(SERVICE_TREE).map(([dept, products]) => {
                const isOpen = expandedDepts[dept] ?? false;
                const deptColors: Record<string, string> = {
                  Fixed: "text-sky-400", Removable: "text-purple-400",
                  Ortho: "text-green-400", Implant: "text-amber-400",
                };
                return (
                  <div key={dept}>
                    <button
                      type="button"
                      onClick={() => setExpandedDepts((p) => ({ ...p, [dept]: !p[dept] }))}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-700/40 transition-colors"
                    >
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                      <span className={`text-xs font-bold uppercase tracking-wider ${deptColors[dept]}`}>{dept}</span>
                    </button>
                    {isOpen && products.map((product) => (
                      <button
                        key={product}
                        type="button"
                        onClick={() => addItem(product, dept)}
                        className="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left text-sm text-gray-400 hover:text-white hover:bg-sky-600/10 border-l-2 border-transparent hover:border-sky-500 transition-all"
                      >
                        <Plus className="w-3 h-3 flex-shrink-0 text-gray-600" />
                        <span className="truncate">{product}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Right: selected items */}
            <div className="flex-1 p-4 overflow-y-auto">
              {caseItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                  <Package className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">No services added yet</p>
                  <p className="text-xs text-gray-600 mt-1">Click a product in the left panel to add it to this case</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {caseItems.map((item) => (
                    <div key={item.localId} className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-white truncate">{item.productType}</span>
                          <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full flex-shrink-0">{item.department}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.localId)}
                          className="text-gray-600 hover:text-red-400 transition-colors ml-3 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Qty</span>
                          <input
                            type="number"
                            min={1}
                            value={item.units}
                            onChange={(e) => updateItem(item.localId, "units", Math.max(1, Number(e.target.value)))}
                            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Shade</span>
                          <input
                            type="text"
                            value={item.shade}
                            onChange={(e) => updateItem(item.localId, "shade", e.target.value)}
                            placeholder="e.g. A2"
                            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Metal</span>
                          <select
                            value={item.metalSelection}
                            onChange={(e) => updateItem(item.localId, "metalSelection", e.target.value)}
                            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-sky-500"
                          >
                            {METAL_OPTIONS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tooth Type</span>
                          <input
                            type="text"
                            value={item.toothType}
                            onChange={(e) => updateItem(item.localId, "toothType", e.target.value)}
                            placeholder="e.g. Molar"
                            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                      {selectedTeeth.length > 0 && (
                        <p className="mt-2 text-xs text-gray-600">
                          Teeth applied:{" "}
                          <span className="text-gray-400">
                            {[...selectedTeeth].sort((a, b) => a - b).join(", ")}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tooth diagram — case-level, applies to all items */}
          <div className="border-t border-gray-700/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <Label>Tooth Diagram — applies to all services on this case</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeeth(Array.from({ length: 16 }, (_, i) => i + 1))}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                >
                  All Upper
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTeeth(Array.from({ length: 16 }, (_, i) => i + 17))}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                >
                  All Lower
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedTeeth([]); setMissingTeeth([]); }}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            <ToothDiagram
              selected={selectedTeeth}
              missing={missingTeeth}
              onChange={(s, m) => { setSelectedTeeth(s); setMissingTeeth(m); }}
            />
          </div>
        </div>

        {/* ══════════════ ERROR + ACTION BAR ══════════════ */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-xl text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 px-5 py-4 bg-gray-800/50 border border-gray-700/60 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={generateSchedule}
              onChange={(e) => setGenerateSchedule(e.target.checked)}
              className="w-4 h-4 accent-sky-500"
            />
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-sm text-gray-300 font-medium">Generate Schedule</span>
            <span className="text-xs text-gray-600">auto-creates 7 department steps</span>
          </label>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/incoming"
              className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-sky-900/30"
            >
              {saving
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              Save Case
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
