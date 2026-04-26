"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

interface ServiceProduct {
  name: string;
  department: string;
  defaultPrice: string | number;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  defaultStatus?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface AsyncAccountSearchProps {
  query: string;
  selectedAccount: DentalAccount | null;
  results: DentalAccount[];
  isLoading: boolean;
  showResults: boolean;
  minimumChars: number;
  error?: string;
  onQueryChange: (value: string) => void;
  onSelect: (account: DentalAccount) => void;
  onFocus: () => void;
  onBlur: () => void;
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const caseItemSchema = z.object({
  productType: z.string().min(1),
  department: z.string().default(""),
  units: z.coerce.number().int().positive().default(1),
  shade: z.string().default(""),
  material: z.string().default("None"),
  price: z.coerce.number().nonnegative().default(0),
  selectedTeeth: z.array(z.number()).default([]),
  missingTeeth: z.array(z.number()).default([]),
});

const newCaseSchema = z.object({
  dentalAccountId: z.string().min(1, "Select a doctor/account"),
  technicianId: z.string().default(""),
  patientFirst: z.string().trim().min(1, "First name required"),
  patientMI: z.string().default(""),
  patientLast: z.string().trim().min(1, "Last name required"),
  patientAge: z.string().default(""),
  patientGender: z.string().default(""),
  caseType: z.enum(["NEW", "REMAKE", "REPAIR"]).default("NEW"),
  priority: z.enum(["NORMAL", "RUSH", "STAT"]).default("NORMAL"),
  rushOrder: z.boolean().default(false),
  tryIn: z.boolean().default(false),
  tryInLeadDays: z.string().default("0"),
  caseGuarantee: z.boolean().default(false),
  generateSchedule: z.boolean().default(true),
  pan: z.string().default(""),
  receivedDate: z.string(),
  dueDate: z.string().default(""),
  shippingAddress: z.string().default(""),
  shippingCarrier: z.string().default("UPS Second Day Air"),
  shippingTime: z.string().default("4:00 PM"),
  caseShade: z.string().default(""),
  softTissueShade: z.string().default(""),
  metalSelection: z.string().default("None"),
  materialsReceived: z.string().default(""),
  notes: z.string().default(""),
  internalNotes: z.string().default(""),
  items: z.array(caseItemSchema).min(1, "Add at least one service"),
});

type FormValues = z.infer<typeof newCaseSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

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

const CARRIERS = [
  "UPS Second Day Air",
  "UPS Ground",
  "FedEx Priority",
  "FedEx Ground",
  "Local Delivery",
  "Courier",
];
const SHIP_TIMES = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];
const MATERIALS = [
  "None", "Zirconia", "E.max", "High Noble Yellow", "High Noble White",
  "Noble", "Base Metal", "Titanium", "Acrylic",
];
const SHADE_SWATCHES = ["A1", "A2", "A3", "A3.5", "B1", "B2", "C1", "C2", "D2", "BL1", "BL2"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-300">
      {children}
    </label>
  );
}

// Accept register() spread via ...rest; discard any passed className to keep styles stable
const TextInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">
>(({ type = "text", ...rest }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      {...rest}
      className="h-9 w-full rounded border border-slate-600 bg-slate-950 px-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
    />
  );
});
TextInput.displayName = "TextInput";

const SelectInput = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ children, ...rest }, ref) => {
  return (
    <select
      ref={ref}
      {...rest}
      className="h-9 w-full rounded border border-slate-600 bg-slate-950 px-2 text-sm text-white outline-none transition focus:border-sky-400"
    >
      {children}
    </select>
  );
});
SelectInput.displayName = "SelectInput";

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

function AsyncAccountSearch({
  query,
  selectedAccount,
  results,
  isLoading,
  showResults,
  minimumChars,
  error,
  onQueryChange,
  onSelect,
  onFocus,
  onBlur,
}: AsyncAccountSearchProps) {
  const canSearch = query.trim().length >= minimumChars;
  const showDropdown = showResults && (canSearch || isLoading || results.length > 0);

  return (
    <div className="relative">
      <FieldLabel>Acct Num / Doctor</FieldLabel>
      <div className="relative">
        <TextInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Type 2+ characters to search"
          autoComplete="off"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {selectedAccount && !showDropdown && (
        <p className="mt-1 text-xs text-slate-400">
          Selected: {selectedAccount.name}
          {selectedAccount.doctorName ? ` - Dr. ${selectedAccount.doctorName}` : ""}
        </p>
      )}
      {showDropdown && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-slate-700 bg-slate-950 shadow-xl">
          {!canSearch ? (
            <div className="px-3 py-2 text-sm text-slate-400">
              Type at least {minimumChars} characters to search accounts.
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching accounts...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matching accounts found.</div>
          ) : (
            results.map((account) => (
              <button
                key={account.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(account)}
                className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-sky-950"
              >
                <span className="font-semibold">{account.name}</span>
                {account.doctorName && (
                  <span className="text-slate-400"> - Dr. {account.doctorName}</span>
                )}
                {(account.city || account.state) && (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {[account.city, account.state].filter(Boolean).join(", ")}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-2 text-sm text-slate-200">
      <input type="checkbox" {...rest} className="h-4 w-4 accent-sky-500" />
      {label}
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewCaseModal({ onClose, onSaved }: Props) {
  // ── External data (not form state) ──────────────────────────────────────────
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [serviceProducts, setServiceProducts] = useState<ServiceProduct[]>([]);

  // ── UI-only state ────────────────────────────────────────────────────────────
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<DentalAccount | null>(null);
  const [accountResults, setAccountResults] = useState<DentalAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAccountResults, setShowAccountResults] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Fixed: true,
    Removable: false,
    Ortho: false,
    Implant: false,
    Shipping: false,
  });
  const [activeTab, setActiveTab] = useState<"services" | "materials" | "notes">("services");
  const [serverError, setServerError] = useState("");

  // ── Form setup ───────────────────────────────────────────────────────────────
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof newCaseSchema>, unknown, z.output<typeof newCaseSchema>>({
    resolver: zodResolver(newCaseSchema),
    defaultValues: {
      caseType: "NEW",
      priority: "NORMAL",
      rushOrder: false,
      tryIn: false,
      tryInLeadDays: "0",
      caseGuarantee: false,
      generateSchedule: true,
      receivedDate: new Date().toISOString().slice(0, 10),
      shippingCarrier: "UPS Second Day Air",
      shippingTime: "4:00 PM",
      metalSelection: "None",
      items: [
        {
          productType: "Crown",
          department: "Fixed",
          units: 1,
          shade: "",
          material: "None",
          price: 0,
          selectedTeeth: [],
          missingTeeth: [],
        },
      ],
    },
  });

  // useFieldArray replaces the manual items array + setItems pattern
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // ── Watched values needed for live display ────────────────────────────────────
  const patientFirst    = watch("patientFirst") ?? "";
  const patientMI       = watch("patientMI") ?? "";
  const patientLast     = watch("patientLast") ?? "";
  const caseType        = watch("caseType");
  const tryIn           = watch("tryIn");
  const caseShade       = watch("caseShade") ?? "";
  const watchedItems    = watch("items") ?? [];
  const dueDate         = watch("dueDate") ?? "";
  const shippingTime    = watch("shippingTime") ?? "";
  const shippingCarrier = watch("shippingCarrier") ?? "";

  // ── Derived values ────────────────────────────────────────────────────────────
  const patientName = [
    patientFirst.trim(),
    patientMI.trim() ? `${patientMI.trim()}.` : "",
    patientLast.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const totalUnits = watchedItems.reduce((s, i) => s + (Number(i.units) || 0), 0);
  const totalValue = watchedItems.reduce((s, i) => s + (Number(i.units) || 0) * (Number(i.price) || 0), 0);
  const totalTeeth = Array.from(
    new Set(
      watchedItems.flatMap((item) =>
        Array.isArray(item.selectedTeeth) ? item.selectedTeeth : []
      )
    )
  ).length;
  const tabHasErrors = {
    services: Boolean(errors.items),
    materials: Boolean(errors.materialsReceived || errors.metalSelection || errors.softTissueShade),
    notes: Boolean(errors.notes || errors.internalNotes),
  } as const;

  const serviceTree = useMemo(() => {
    if (!serviceProducts.length) return SERVICE_TREE;
    return serviceProducts.reduce<Record<string, string[]>>((tree, p) => {
      tree[p.department] = tree[p.department] ?? [];
      tree[p.department].push(p.name);
      return tree;
    }, {});
  }, [serviceProducts]);

  // ── Data fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/technicians").then((r) => r.json()),
      fetch("/api/settings/lab").then((r) => r.json()),
    ])
      .then(([techData, labData]) => {
        setTechnicians(Array.isArray(techData) ? techData : []);
        setServiceProducts(
          Array.isArray(labData.products)
            ? labData.products.filter((p: ServiceProduct) => p.isActive)
            : []
        );
      })
      .catch(() => {
        setTechnicians([]);
      });
  }, []);

  useEffect(() => {
    const query = accountSearch.trim();
    if (query.length < 2) {
      setAccountResults([]);
      setLoadingAccounts(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoadingAccounts(true);
      try {
        const response = await fetch(
          `/api/accounts?search=${encodeURIComponent(query)}&limit=12`,
          { signal: controller.signal }
        );
        const data = await response.json();
        setAccountResults(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccountResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingAccounts(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [accountSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function selectAccount(account: DentalAccount) {
    setSelectedAccount(account);
    setValue("dentalAccountId", account.id, { shouldValidate: true });
    setAccountSearch(
      `${account.name}${account.doctorName ? ` - Dr. ${account.doctorName}` : ""}`
    );
    setAccountResults([]);
    setShowAccountResults(false);
    const parts = [account.address, account.city, account.state, account.zip].filter(Boolean);
    if (parts.length) setValue("shippingAddress", parts.join(", "));
  }

  async function onSubmit(data: FormValues) {
    setServerError("");
    try {
      const patientNameStr = [
        data.patientFirst.trim(),
        data.patientMI?.trim() ? `${data.patientMI.trim()}.` : "",
        data.patientLast.trim(),
      ]
        .filter(Boolean)
        .join(" ");
      const caseSelectedTeeth = Array.from(
        new Set(data.items.flatMap((item) => item.selectedTeeth ?? []))
      ).sort((a, b) => a - b);
      const caseMissingTeeth = Array.from(
        new Set(data.items.flatMap((item) => item.missingTeeth ?? []))
      ).sort((a, b) => a - b);

      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientNameStr,
          patientFirst: data.patientFirst.trim(),
          patientMI: data.patientMI?.trim() || null,
          patientLast: data.patientLast.trim(),
          patientAge: data.patientAge ? Number(data.patientAge) : null,
          patientGender: data.patientGender || null,
          dentalAccountId: data.dentalAccountId,
          technicianId: data.technicianId || null,
          priority: data.priority,
          caseType: data.caseType,
          caseOrigin: "LOCAL",
          route: data.shippingCarrier === "Local Delivery" ? "LOCAL" : "SHIP",
          rushOrder: data.rushOrder,
          tryIn: data.tryIn,
          tryInLeadDays: data.tryIn ? Number(data.tryInLeadDays || 0) : null,
          caseGuarantee: data.caseGuarantee,
          receivedDate: data.receivedDate ? new Date(data.receivedDate).toISOString() : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
          pan: data.pan || null,
          shade: data.caseShade || null,
          softTissueShade: data.softTissueShade || null,
          metalSelection: data.metalSelection !== "None" ? data.metalSelection : null,
          selectedTeeth: caseSelectedTeeth.length ? JSON.stringify(caseSelectedTeeth) : null,
          missingTeeth: caseMissingTeeth.length ? JSON.stringify(caseMissingTeeth) : null,
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
          materialsReceived: data.materialsReceived || null,
          shippingAddress: data.shippingAddress || null,
          shippingCarrier: data.shippingCarrier || null,
          shippingTime: data.shippingTime || null,
          generateSchedule: data.generateSchedule,
          items: data.items.map((item) => ({
            productType: item.productType,
            toothNumbers: item.selectedTeeth.length
              ? [...item.selectedTeeth].sort((a, b) => a - b).join(", ")
              : null,
            units: Number(item.units),
            shade: item.shade || data.caseShade || null,
            material: item.material !== "None" ? item.material : null,
            notes: item.department,
            price: Number(item.price),
          })),
        }),
      });

      if (!response.ok) {
        const resData = await response.json().catch(() => null);
        setServerError(resData?.error ?? "Case could not be created.");
        return;
      }

      onSaved();
    } catch {
      setServerError("An unexpected error occurred.");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex h-14 items-center justify-between border-b border-slate-700 bg-slate-900 px-5">
          <div>
            <h2 className="text-base font-bold text-white">New Case / Order</h2>
            <p className="text-xs text-slate-400">
              {patientName || "Patient not entered"}
              {selectedAccount ? ` - ${selectedAccount.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="new-case-order-form"
              disabled={isSubmitting}
              className="flex h-9 items-center gap-2 rounded bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create Case
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Form ───────────────────────────────────────────────────────────── */}
        <form id="new-case-order-form" onSubmit={handleSubmit(onSubmit)} className="overflow-auto p-4">
          {/* Hidden field — value set programmatically via selectAccount() */}
          <input type="hidden" {...register("dentalAccountId")} />

          <div className="grid gap-3 xl:grid-cols-[1fr_370px]">
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">

                {/* ── Doctor panel ──────────────────────────────────────────── */}
                <Panel title="Doctor" icon={UserRound}>
                  <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                    <AsyncAccountSearch
                      query={accountSearch}
                      selectedAccount={selectedAccount}
                      results={accountResults}
                      isLoading={loadingAccounts}
                      showResults={showAccountResults}
                      minimumChars={2}
                      error={errors.dentalAccountId?.message}
                      onQueryChange={(value) => {
                        setAccountSearch(value);
                        setShowAccountResults(true);
                        setSelectedAccount(null);
                        setValue("dentalAccountId", "", { shouldValidate: true });
                      }}
                      onSelect={selectAccount}
                      onFocus={() => setShowAccountResults(true)}
                      onBlur={() => {
                        window.setTimeout(() => setShowAccountResults(false), 120);
                      }}
                    />

                    <div>
                      <FieldLabel>Technician</FieldLabel>
                      <SelectInput {...register("technicianId")}>
                        <option value="">Unassigned</option>
                        {technicians.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </SelectInput>
                    </div>

                    <div>
                      <FieldLabel>Ship To</FieldLabel>
                      <TextInput {...register("shippingAddress")} placeholder="Shipping address" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>Carrier</FieldLabel>
                        <SelectInput {...register("shippingCarrier")}>
                          {CARRIERS.map((c) => <option key={c}>{c}</option>)}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Ship Time</FieldLabel>
                        <SelectInput {...register("shippingTime")}>
                          {SHIP_TIMES.map((t) => <option key={t}>{t}</option>)}
                        </SelectInput>
                      </div>
                    </div>
                  </div>
                </Panel>

                {/* ── Order Details panel ───────────────────────────────────── */}
                <Panel title="Order Details" icon={ClipboardList}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>Case Type</FieldLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {(["NEW", "REMAKE", "REPAIR"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setValue("caseType", type, { shouldValidate: true })}
                            className={`h-9 rounded border text-xs font-bold ${
                              caseType === type
                                ? "border-sky-300 bg-sky-600 text-white"
                                : "border-slate-700 bg-slate-950 text-slate-300"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Priority</FieldLabel>
                      <SelectInput {...register("priority")}>
                        <option value="NORMAL">NORMAL</option>
                        <option value="RUSH">RUSH</option>
                        <option value="STAT">STAT</option>
                      </SelectInput>
                    </div>

                    <div>
                      <FieldLabel>Received Date</FieldLabel>
                      <TextInput type="date" {...register("receivedDate")} />
                    </div>

                    <div>
                      <FieldLabel>Delivery Due Date</FieldLabel>
                      <TextInput type="date" {...register("dueDate")} />
                    </div>

                    <div>
                      <FieldLabel>Pan Number</FieldLabel>
                      <TextInput {...register("pan")} />
                    </div>

                    <div>
                      <FieldLabel>Try-In Lead Days</FieldLabel>
                      <TextInput
                        type="number"
                        {...register("tryInLeadDays")}
                        disabled={!tryIn}
                      />
                    </div>

                    <div className="col-span-full grid grid-cols-2 gap-x-4 md:grid-cols-4">
                      <Checkbox label="Rush Order"      {...register("rushOrder")} />
                      <Checkbox label="Try-In Required" {...register("tryIn")} />
                      <Checkbox label="Guarantee"       {...register("caseGuarantee")} />
                      <Checkbox label="Schedule"        {...register("generateSchedule")} />
                    </div>
                  </div>
                </Panel>
              </div>

              {/* ── Patient Details panel ─────────────────────────────────────── */}
              <Panel title="Patient Details" icon={FileText}>
                <div className="grid gap-3 md:grid-cols-[1fr_80px_1fr_90px_130px]">
                  <div>
                    <FieldLabel>First Name</FieldLabel>
                    <TextInput {...register("patientFirst")} />
                    {errors.patientFirst && (
                      <p className="mt-1 text-xs text-red-400">{errors.patientFirst.message}</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel>MI</FieldLabel>
                    <TextInput {...register("patientMI")} />
                  </div>
                  <div>
                    <FieldLabel>Last Name</FieldLabel>
                    <TextInput {...register("patientLast")} />
                    {errors.patientLast && (
                      <p className="mt-1 text-xs text-red-400">{errors.patientLast.message}</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Age</FieldLabel>
                    <TextInput type="number" {...register("patientAge")} />
                  </div>
                  <div>
                    <FieldLabel>Gender</FieldLabel>
                    <SelectInput {...register("patientGender")}>
                      <option value="">Unknown</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </SelectInput>
                  </div>
                </div>
              </Panel>

              {/* ── Tabs section ─────────────────────────────────────────────── */}
              <section className="border border-slate-700 bg-slate-900">
                <div className="flex h-10 items-center border-b border-slate-700 bg-slate-800">
                  {(["services", "materials", "notes"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`h-full border-r border-slate-700 px-4 text-xs font-bold ${
                        activeTab === key
                          ? "bg-yellow-400 text-slate-950"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>
                          {key === "services" ? "Services" : key === "materials" ? "Material Received" : "Notes"}
                        </span>
                        {tabHasErrors[key] && (
                          <span
                            aria-label={`${key} tab has validation errors`}
                            className={`inline-block h-2 w-2 rounded-full ${
                              activeTab === key ? "bg-red-600" : "bg-red-400"
                            }`}
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Services tab */}
                {activeTab === "services" && (
                  <div className="grid min-h-[360px] lg:grid-cols-[230px_1fr]">
                    {/* Service tree */}
                    <div className="border-r border-slate-700 bg-slate-950">
                      <div className="border-b border-slate-800 p-2">
                        <FieldLabel>Type Product #</FieldLabel>
                        <TextInput placeholder="Search services" />
                      </div>
                      <div className="max-h-[320px] overflow-auto">
                        {Object.entries(serviceTree).map(([dept, products]) => {
                          const open = expandedGroups[dept];
                          return (
                            <div key={dept}>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedGroups((g) => ({ ...g, [dept]: !open }))
                                }
                                className="flex w-full items-center gap-1 border-b border-slate-800 bg-slate-900 px-2 py-1.5 text-left text-xs font-bold text-yellow-200"
                              >
                                {open ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {dept}
                              </button>
                              {open &&
                                products.map((product) => (
                                  <button
                                    key={product}
                                    type="button"
                                    onClick={() => {
                                      const catalogItem = serviceProducts.find(
                                        (c) => c.department === dept && c.name === product
                                      );
                                      append({
                                        productType: product,
                                        department: dept,
                                        units: 1,
                                        shade: "",
                                        material: "None",
                                        price: Number(catalogItem?.defaultPrice ?? 0),
                                        selectedTeeth: [],
                                        missingTeeth: [],
                                      });
                                    }}
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

                    {/* Items table — useFieldArray drives the rows */}
                    <div className="p-3">
                      <div className="space-y-3">
                        {fields.map((field, index) => {
                          const itemSelectedTeeth = watchedItems[index]?.selectedTeeth ?? [];
                          const itemMissingTeeth = watchedItems[index]?.missingTeeth ?? [];

                          return (
                            <div
                              key={field.id}
                              className="rounded-lg border border-slate-700 bg-slate-950/70 p-3"
                            >
                              <div className="mb-3 grid gap-2 md:grid-cols-[1fr_60px_90px_124px_84px_40px]">
                                <TextInput {...register(`items.${index}.productType`)} />
                                <TextInput type="number" {...register(`items.${index}.units`)} />
                                <TextInput {...register(`items.${index}.shade`)} />
                                <SelectInput {...register(`items.${index}.material`)}>
                                  {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                                </SelectInput>
                                <TextInput type="number" {...register(`items.${index}.price`)} />
                                <button
                                  type="button"
                                  onClick={() => remove(index)}
                                  disabled={fields.length === 1}
                                  className="flex h-9 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300 disabled:opacity-30"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                    Tooth / Arch Selection
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Map this specific service line to the right teeth or arch.
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setValue(
                                        `items.${index}.selectedTeeth`,
                                        Array.from({ length: 16 }, (_, i) => i + 1),
                                        { shouldDirty: true }
                                      )
                                    }
                                    className="h-8 rounded bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                                  >
                                    Upper Arch
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setValue(
                                        `items.${index}.selectedTeeth`,
                                        Array.from({ length: 16 }, (_, i) => i + 17),
                                        { shouldDirty: true }
                                      )
                                    }
                                    className="h-8 rounded bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                                  >
                                    Lower Arch
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setValue(`items.${index}.selectedTeeth`, [], { shouldDirty: true });
                                      setValue(`items.${index}.missingTeeth`, [], { shouldDirty: true });
                                    }}
                                    className="h-8 rounded bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>

                              <ToothDiagram
                                selected={itemSelectedTeeth}
                                missing={itemMissingTeeth}
                                onChange={(sel, miss) => {
                                  setValue(`items.${index}.selectedTeeth`, sel, { shouldDirty: true });
                                  setValue(`items.${index}.missingTeeth`, miss, { shouldDirty: true });
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Materials tab */}
                {activeTab === "materials" && (
                  <div className="grid min-h-[360px] gap-3 p-3 lg:grid-cols-2">
                    <div>
                      <FieldLabel>Material Received</FieldLabel>
                      <textarea
                        {...register("materialsReceived")}
                        className="h-40 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                        placeholder="Models, impressions, scans, analogs, bites..."
                      />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <FieldLabel>Metal Selection</FieldLabel>
                        <SelectInput {...register("metalSelection")}>
                          {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Soft Tissue Shade</FieldLabel>
                        <TextInput {...register("softTissueShade")} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes tab */}
                {activeTab === "notes" && (
                  <div className="grid min-h-[360px] gap-3 p-3 lg:grid-cols-2">
                    <div>
                      <FieldLabel>Doctor / Case Notes</FieldLabel>
                      <textarea
                        {...register("notes")}
                        className="h-72 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <FieldLabel>Internal Notes</FieldLabel>
                      <textarea
                        {...register("internalNotes")}
                        className="h-72 w-full resize-none rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* ── Right column ─────────────────────────────────────────────── */}
            <div className="space-y-3">
              <Panel title="Tooth Mapping" icon={FlaskConical}>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    Each service line now carries its own tooth or arch assignment.
                  </p>
                  <p className="text-slate-400">
                    Use the selector inside each item card so a crown can stay on
                    tooth 8 while a removable or full-arch service maps to the upper
                    or lower arch.
                  </p>
                </div>
              </Panel>

              <Panel title="Shade Color" icon={ShieldCheck}>
                <div className="grid grid-cols-4 gap-2">
                  {SHADE_SWATCHES.map((shade) => (
                    <button
                      key={shade}
                      type="button"
                      onClick={() => setValue("caseShade", shade)}
                      className={`h-8 rounded border text-xs font-bold ${
                        caseShade === shade
                          ? "border-sky-300 bg-sky-600 text-white"
                          : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {shade}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <FieldLabel>Custom Shade</FieldLabel>
                  <TextInput {...register("caseShade")} placeholder="e.g. A2, BL1" />
                </div>
              </Panel>

              <Panel title="Delivery" icon={CalendarDays}>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Due</span>
                    <span>{dueDate || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ship</span>
                    <span>{shippingTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Carrier</span>
                    <span>{shippingCarrier}</span>
                  </div>
                </div>
              </Panel>

              <Panel title="Order Summary" icon={PackagePlus}>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Services</span>
                    <span>{fields.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Units</span>
                    <span>{totalUnits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Teeth</span>
                    <span>{totalTeeth}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700 pt-2 font-bold text-white">
                    <span>Total</span>
                    <span>${totalValue.toFixed(2)}</span>
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          {serverError && (
            <div className="mt-3 flex items-center gap-2 border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100">
              <AlertCircle className="h-4 w-4" />
              {serverError}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
