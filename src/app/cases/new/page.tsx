"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  PackagePlus,
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
type StepKey = "patient" | "products" | "delivery";

const STEP_ORDER: Array<{ key: StepKey; title: string; description: string }> = [
  { key: "patient", title: "Patient / Doctor", description: "Doctor account, technician, and patient identity" },
  { key: "products", title: "Products & Teeth", description: "Prescription lines, quantities, and tooth mapping" },
  { key: "delivery", title: "Delivery & Notes", description: "Dates, carrier, shades, materials, and instructions" },
];

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

const TextInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">
>(({ type = "text", ...rest }, ref) => (
  <input
    ref={ref}
    type={type}
    {...rest}
    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
  />
));
TextInput.displayName = "TextInput";

const SelectInput = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ children, ...rest }, ref) => (
  <select
    ref={ref}
    {...rest}
    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-400"
  >
    {children}
  </select>
));
SelectInput.displayName = "SelectInput";

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-bold text-white">{title}</h2>
        </div>
        {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
      <input type="checkbox" {...rest} className="h-4 w-4 accent-sky-500" />
      {label}
    </label>
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
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
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
                {account.doctorName && <span className="text-slate-400"> - Dr. {account.doctorName}</span>}
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

function makeDefaultItem(productType: string, department: string, defaultPrice = 0) {
  return {
    productType,
    department,
    units: 1,
    shade: "",
    material: "None",
    price: defaultPrice,
    selectedTeeth: [] as number[],
    missingTeeth: [] as number[],
  };
}

export default function NewCasePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepKey>("patient");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [serviceProducts, setServiceProducts] = useState<ServiceProduct[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DentalAccount | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
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
  const [serverError, setServerError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
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
      items: [makeDefaultItem("Crown", "Fixed", 0)],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const patientFirst = watch("patientFirst") ?? "";
  const patientMI = watch("patientMI") ?? "";
  const patientLast = watch("patientLast") ?? "";
  const caseType = watch("caseType");
  const tryIn = watch("tryIn");
  const caseShade = watch("caseShade") ?? "";
  const watchedItems = watch("items") ?? [];
  const dueDate = watch("dueDate") ?? "";

  const patientName = [patientFirst.trim(), patientMI.trim() ? `${patientMI.trim()}.` : "", patientLast.trim()]
    .filter(Boolean)
    .join(" ");

  const totalUnits = watchedItems.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalValue = watchedItems.reduce(
    (sum, item) => sum + (Number(item.units) || 0) * (Number(item.price) || 0),
    0
  );
  const totalTeeth = Array.from(
    new Set(watchedItems.flatMap((item) => (Array.isArray(item.selectedTeeth) ? item.selectedTeeth : [])))
  ).length;

  const serviceTree = useMemo(() => {
    if (!serviceProducts.length) return SERVICE_TREE;
    return serviceProducts.reduce<Record<string, string[]>>((tree, product) => {
      tree[product.department] = tree[product.department] ?? [];
      tree[product.department].push(product.name);
      return tree;
    }, {});
  }, [serviceProducts]);

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
        setServiceProducts([]);
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
        const response = await fetch(`/api/accounts?search=${encodeURIComponent(query)}&limit=12`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setAccountResults(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccountResults([]);
        }
      } finally {
        setLoadingAccounts(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [accountSearch]);

  function selectAccount(account: DentalAccount) {
    setSelectedAccount(account);
    setAccountSearch(`${account.name}${account.doctorName ? ` - Dr. ${account.doctorName}` : ""}`);
    setShowAccountResults(false);
    setValue("dentalAccountId", account.id, { shouldDirty: true, shouldValidate: true });

    const addressParts = [account.address, account.city, account.state, account.zip].filter(Boolean);
    if (addressParts.length) {
      setValue("shippingAddress", addressParts.join(", "), { shouldDirty: true });
    }
  }

  function addServiceLine(productType: string, department: string) {
    const catalogItem = serviceProducts.find(
      (serviceProduct) => serviceProduct.department === department && serviceProduct.name === productType
    );
    append(makeDefaultItem(productType, department, Number(catalogItem?.defaultPrice ?? 0)));
  }

  async function goToStep(step: StepKey) {
    if (step === currentStep) return;

    if (step === "products") {
      const valid = await trigger(["dentalAccountId", "patientFirst", "patientLast"]);
      if (!valid) return;
    }

    if (step === "delivery") {
      const valid = await trigger([
        "dentalAccountId",
        "patientFirst",
        "patientLast",
        "items",
      ]);
      if (!valid) return;
    }

    setCurrentStep(step);
    setServerError("");
  }

  async function goNext() {
    const currentIndex = STEP_ORDER.findIndex((step) => step.key === currentStep);
    const nextStep = STEP_ORDER[currentIndex + 1];
    if (!nextStep) return;
    await goToStep(nextStep.key);
  }

  function goBack() {
    const currentIndex = STEP_ORDER.findIndex((step) => step.key === currentStep);
    const previousStep = STEP_ORDER[currentIndex - 1];
    if (previousStep) {
      setCurrentStep(previousStep.key);
      setServerError("");
    }
  }

  const onSubmit = async (data: FormValues) => {
    setServerError("");

    try {
      const patientNameStr = [data.patientFirst.trim(), data.patientMI.trim() ? `${data.patientMI.trim()}.` : "", data.patientLast.trim()]
        .filter(Boolean)
        .join(" ");
      const selectedTeeth = Array.from(new Set(data.items.flatMap((item) => item.selectedTeeth ?? []))).sort(
        (a, b) => a - b
      );
      const missingTeeth = Array.from(new Set(data.items.flatMap((item) => item.missingTeeth ?? []))).sort(
        (a, b) => a - b
      );

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
          selectedTeeth: selectedTeeth.length ? JSON.stringify(selectedTeeth) : null,
          missingTeeth: missingTeeth.length ? JSON.stringify(missingTeeth) : null,
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
          materialsReceived: data.materialsReceived || null,
          shippingAddress: data.shippingAddress || null,
          shippingCarrier: data.shippingCarrier || null,
          shippingTime: data.shippingTime || null,
          items: data.items.map((item) => ({
            productType: item.productType,
            toothNumbers: item.selectedTeeth.length
              ? [...item.selectedTeeth].sort((a, b) => a - b).join(",")
              : null,
            units: Number(item.units) || 1,
            shade: item.shade || null,
            material: item.material || null,
            notes: item.department || null,
            price: Number(item.price) || 0,
          })),
          generateSchedule: data.generateSchedule,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to create case.");
      }

      const nextCaseNumber = payload?.caseNumber ?? payload?.id;
      router.push(nextCaseNumber ? `/cases/${encodeURIComponent(nextCaseNumber)}` : "/incoming");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to create case.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Link
                href="/incoming"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div>
                <h1 className="text-2xl font-bold">New Case / Order</h1>
                <p className="text-sm text-slate-400">
                  A full-page entry flow so technicians do not lose work to an accidental modal close.
                </p>
              </div>
            </div>
          </div>
          <button
            type="submit"
            form="new-case-page-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Create Case
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <Panel title="Stepper" description="Move down the prescription in a calmer vertical flow." icon={ClipboardList}>
            <div className="space-y-2">
              {STEP_ORDER.map((step, index) => {
                const active = currentStep === step.key;
                const complete = STEP_ORDER.findIndex((candidate) => candidate.key === currentStep) > index;

                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => void goToStep(step.key)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-sky-500 bg-sky-950/40"
                        : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        complete
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-sky-500 text-white"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{step.title}</span>
                      <span className="mt-1 block text-xs text-slate-400">{step.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Summary" description="Keep the important totals visible while you tab through." icon={ShieldCheck}>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between"><span className="text-slate-500">Patient</span><span>{patientName || "Draft"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Services</span><span>{fields.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Units</span><span>{totalUnits}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mapped Teeth</span><span>{totalTeeth}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Due Date</span><span>{dueDate || "Not set"}</span></div>
              <div className="flex justify-between border-t border-slate-800 pt-3 font-semibold text-white">
                <span>Estimated Total</span>
                <span>${totalValue.toFixed(2)}</span>
              </div>
            </div>
          </Panel>
        </aside>

        <form id="new-case-page-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <input type="hidden" {...register("dentalAccountId")} />

          {currentStep === "patient" && (
            <div className="space-y-6">
              <Panel title="Doctor / Account" description="Pick the practice first so the rest of the order lands in the right place." icon={UserRound}>
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
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
                      setValue("dentalAccountId", "", { shouldDirty: true, shouldValidate: true });
                    }}
                    onSelect={selectAccount}
                    onFocus={() => setShowAccountResults(true)}
                    onBlur={() => setTimeout(() => setShowAccountResults(false), 120)}
                  />
                  <div>
                    <FieldLabel>Technician</FieldLabel>
                    <SelectInput {...register("technicianId")}>
                      <option value="">Unassigned</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                </div>

                {selectedAccount && (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                    <p className="font-semibold text-white">{selectedAccount.name}</p>
                    {selectedAccount.doctorName ? <p className="text-slate-400">Dr. {selectedAccount.doctorName}</p> : null}
                    <p className="mt-1 text-slate-500">
                      {[selectedAccount.address, selectedAccount.city, selectedAccount.state, selectedAccount.zip]
                        .filter(Boolean)
                        .join(", ") || "No saved shipping address"}
                    </p>
                  </div>
                )}
              </Panel>

              <Panel title="Patient Details" description="Keyboard-first fields so front-desk entry keeps moving." icon={FileText}>
                <div className="grid gap-4 md:grid-cols-[1fr_90px_1fr_100px_160px]">
                  <div>
                    <FieldLabel>First Name</FieldLabel>
                    <TextInput {...register("patientFirst")} />
                    {errors.patientFirst && <p className="mt-1 text-xs text-red-400">{errors.patientFirst.message}</p>}
                  </div>
                  <div>
                    <FieldLabel>MI</FieldLabel>
                    <TextInput {...register("patientMI")} />
                  </div>
                  <div>
                    <FieldLabel>Last Name</FieldLabel>
                    <TextInput {...register("patientLast")} />
                    {errors.patientLast && <p className="mt-1 text-xs text-red-400">{errors.patientLast.message}</p>}
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
            </div>
          )}

          {currentStep === "products" && (
            <div className="space-y-6">
              <Panel title="Prescription Details" description="Set the case type and then map each service line to the right teeth." icon={PackagePlus}>
                <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="border-b border-slate-800 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service Catalog</p>
                    </div>
                    <div className="max-h-[720px] overflow-auto">
                      {Object.entries(serviceTree).map(([department, products]) => {
                        const open = expandedGroups[department];
                        return (
                          <div key={department}>
                            <button
                              type="button"
                              onClick={() => setExpandedGroups((current) => ({ ...current, [department]: !open }))}
                              className="flex w-full items-center gap-2 border-b border-slate-800 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-yellow-200"
                            >
                              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {department}
                            </button>
                            {open &&
                              products.map((product) => (
                                <button
                                  key={product}
                                  type="button"
                                  onClick={() => addServiceLine(product, department)}
                                  className="flex w-full items-center gap-2 border-b border-slate-900 px-5 py-2 text-left text-xs text-slate-300 hover:bg-sky-950 hover:text-white"
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

                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]">
                      <div>
                        <FieldLabel>Case Type</FieldLabel>
                        <div className="grid grid-cols-3 gap-2">
                          {(["NEW", "REMAKE", "REPAIR"] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setValue("caseType", value)}
                              className={`h-10 rounded-lg border text-sm font-semibold ${
                                caseType === value
                                  ? "border-sky-300 bg-sky-600 text-white"
                                  : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
                              }`}
                            >
                              {value}
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
                        <FieldLabel>Pan Number</FieldLabel>
                        <TextInput {...register("pan")} />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <Checkbox label="Rush Order" {...register("rushOrder")} />
                      <Checkbox label="Try-In Required" {...register("tryIn")} />
                      <Checkbox label="Guarantee" {...register("caseGuarantee")} />
                      <Checkbox label="Generate Schedule" {...register("generateSchedule")} />
                    </div>

                    {tryIn && (
                      <div className="max-w-[220px]">
                        <FieldLabel>Try-In Lead Days</FieldLabel>
                        <TextInput type="number" {...register("tryInLeadDays")} />
                      </div>
                    )}

                    {errors.items && (
                      <div className="rounded-lg border border-red-700 bg-red-950 px-3 py-2 text-sm text-red-100">
                        {errors.items.message}
                      </div>
                    )}

                    <div className="space-y-4">
                      {fields.map((field, index) => {
                        const itemSelectedTeeth = watchedItems[index]?.selectedTeeth ?? [];
                        const itemMissingTeeth = watchedItems[index]?.missingTeeth ?? [];

                        return (
                          <div key={field.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_80px_120px_140px_100px_44px]">
                              <div>
                                <FieldLabel>Service</FieldLabel>
                                <TextInput {...register(`items.${index}.productType`)} />
                              </div>
                              <div>
                                <FieldLabel>Qty</FieldLabel>
                                <TextInput type="number" {...register(`items.${index}.units`)} />
                              </div>
                              <div>
                                <FieldLabel>Shade</FieldLabel>
                                <TextInput {...register(`items.${index}.shade`)} />
                              </div>
                              <div>
                                <FieldLabel>Material</FieldLabel>
                                <SelectInput {...register(`items.${index}.material`)}>
                                  {MATERIALS.map((material) => (
                                    <option key={material}>{material}</option>
                                  ))}
                                </SelectInput>
                              </div>
                              <div>
                                <FieldLabel>Price</FieldLabel>
                                <TextInput type="number" {...register(`items.${index}.price`)} />
                              </div>
                              <div>
                                <FieldLabel>&nbsp;</FieldLabel>
                                <button
                                  type="button"
                                  onClick={() => remove(index)}
                                  disabled={fields.length === 1}
                                  className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300 disabled:opacity-30"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                  Tooth / Arch Selection
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Each service line carries its own tooth mapping.
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
                                  className="h-8 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
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
                                  className="h-8 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                                >
                                  Lower Arch
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setValue(`items.${index}.selectedTeeth`, [], { shouldDirty: true });
                                    setValue(`items.${index}.missingTeeth`, [], { shouldDirty: true });
                                  }}
                                  className="h-8 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>

                            <ToothDiagram
                              selected={itemSelectedTeeth}
                              missing={itemMissingTeeth}
                              onChange={(selected, missing) => {
                                setValue(`items.${index}.selectedTeeth`, selected, { shouldDirty: true });
                                setValue(`items.${index}.missingTeeth`, missing, { shouldDirty: true });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {currentStep === "delivery" && (
            <div className="space-y-6">
              <Panel title="Delivery" description="Dates, carrier, and outbound shipping details." icon={Truck}>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_180px]">
                  <div>
                    <FieldLabel>Received Date</FieldLabel>
                    <TextInput type="date" {...register("receivedDate")} />
                  </div>
                  <div>
                    <FieldLabel>Delivery Due Date</FieldLabel>
                    <TextInput type="date" {...register("dueDate")} />
                  </div>
                  <div>
                    <FieldLabel>Carrier</FieldLabel>
                    <SelectInput {...register("shippingCarrier")}>
                      {CARRIERS.map((carrier) => (
                        <option key={carrier}>{carrier}</option>
                      ))}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Ship Time</FieldLabel>
                    <SelectInput {...register("shippingTime")}>
                      {SHIP_TIMES.map((time) => (
                        <option key={time}>{time}</option>
                      ))}
                    </SelectInput>
                  </div>
                </div>

                <div className="mt-4">
                  <FieldLabel>Ship To</FieldLabel>
                  <textarea
                    {...register("shippingAddress")}
                    className="h-24 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                  />
                </div>
              </Panel>

              <Panel title="Materials & Notes" description="Keep supporting shades, materials, and written instructions together." icon={CalendarDays}>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Case Shade</FieldLabel>
                      <div className="grid grid-cols-4 gap-2">
                        {SHADE_SWATCHES.map((shade) => (
                          <button
                            key={shade}
                            type="button"
                            onClick={() => setValue("caseShade", shade)}
                            className={`h-9 rounded-lg border text-xs font-bold ${
                              caseShade === shade
                                ? "border-sky-300 bg-sky-600 text-white"
                                : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
                            }`}
                          >
                            {shade}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Custom Shade</FieldLabel>
                      <TextInput {...register("caseShade")} placeholder="e.g. A2, BL1" />
                    </div>
                    <div>
                      <FieldLabel>Soft Tissue Shade</FieldLabel>
                      <TextInput {...register("softTissueShade")} />
                    </div>
                    <div>
                      <FieldLabel>Metal Selection</FieldLabel>
                      <SelectInput {...register("metalSelection")}>
                        {MATERIALS.map((material) => (
                          <option key={material}>{material}</option>
                        ))}
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Material Received</FieldLabel>
                      <textarea
                        {...register("materialsReceived")}
                        className="h-28 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Doctor / Case Notes</FieldLabel>
                      <textarea
                        {...register("notes")}
                        className="h-40 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <FieldLabel>Internal Notes</FieldLabel>
                      <textarea
                        {...register("internalNotes")}
                        className="h-40 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {serverError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100">
              <AlertCircle className="h-4 w-4" />
              {serverError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === "patient" || isSubmitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-900 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep !== "delivery" ? (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={isSubmitting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Create Case
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
