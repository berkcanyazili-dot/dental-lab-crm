"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import ToothDiagram from "@/components/ui/ToothDiagram";
import { parseLabInboxArchive, type ImportedInboxAttachment } from "@/lib/inboxImport";

interface DentalAccount {
  id: string;
  name: string;
  doctorName: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface ServiceProduct {
  name: string;
  department: string;
  defaultPrice: string | number;
  isActive: boolean;
  sortOrder: number;
}

interface Technician {
  id: string;
  name: string;
}

interface DraftAttachment {
  id: string;
  file: File;
  fileType: "stl" | "pdf" | "image" | "other";
}

interface CaseItemRow {
  localId: string;
  productType: string;
  department: string;
  units: number;
  shade: string;
  material: string;
  price: number;
  selectedTeeth: number[];
  missingTeeth: number[];
}

type StepKey = "patient" | "rx" | "attachments" | "review";

const STEP_ORDER: Array<{ key: StepKey; title: string; description: string }> = [
  { key: "patient", title: "Patient & Doctor", description: "Doctor, patient, and delivery details" },
  { key: "rx", title: "Rx & Teeth", description: "Case type, services, and tooth mapping" },
  { key: "attachments", title: "Attachments", description: "STLs, RX PDFs, and photos" },
  { key: "review", title: "Review", description: "Double-check before creating the case" },
];

const FALLBACK_SERVICE_TREE: Record<string, string[]> = {
  Fixed: ["Crown", "Implant Crown", "Anterior Zirconia", "Posterior Zirconia", "Bridge Services"],
  Removable: ["Denture", "Acrylic Partial", "Cast Partial"],
  Ortho: ["Ortho Retainer", "Custom Tray", "Ortho Repair"],
  Implant: ["Full Arch Restoration", "Soft Tissue", "Implant Overdenture"],
  Shipping: ["Local Delivery", "Shipping Fee"],
};

const CARRIERS = ["UPS Second Day Air", "UPS Ground", "FedEx Priority", "FedEx Ground", "Local Delivery", "Courier"];
const SHIP_TIMES = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const MATERIALS = ["None", "Zirconia", "E.max", "High Noble Yellow", "High Noble White", "Noble", "Base Metal", "Titanium", "Acrylic"];
const SHADE_SWATCHES = ["A1", "A2", "A3", "A3.5", "B1", "B2", "C1", "C2", "D2", "BL1", "BL2"];
const ACCEPTED_ATTACHMENT_TYPES = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg", ".webp"],
  "model/stl": [".stl"],
  "application/sla": [".stl"],
  "application/octet-stream": [".stl"],
};
const ACCEPTED_INBOX_ARCHIVE_TYPES = {
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
  "application/octet-stream": [".zip"],
};
const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_INBOX_ARCHIVE_SIZE_BYTES = 100 * 1024 * 1024;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-300">{children}</label>;
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400 ${className}`}
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
      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-400"
    >
      {children}
    </select>
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
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
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

function inferClientAttachmentType(file: File): DraftAttachment["fileType"] {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".stl")) return "stl";
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "other";
}

function makeItem(productType: string, department: string, defaultPrice = 0): CaseItemRow {
  return {
    localId: `${Date.now()}-${Math.random()}`,
    productType,
    department,
    units: 1,
    shade: "",
    material: "None",
    price: defaultPrice,
    selectedTeeth: [],
    missingTeeth: [],
  };
}

export default function NewCasePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepKey>("patient");
  const [accounts, setAccounts] = useState<DentalAccount[]>([]);
  const [accountResults, setAccountResults] = useState<DentalAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [serviceProducts, setServiceProducts] = useState<ServiceProduct[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Fixed: true,
    Removable: false,
    Ortho: false,
    Implant: false,
    Shipping: false,
  });

  const [accountSearch, setAccountSearch] = useState("");
  const [showAccountResults, setShowAccountResults] = useState(false);
  const [dentalAccountId, setDentalAccountId] = useState("");
  const [technicianId, setTechnicianId] = useState("");

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
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("UPS Second Day Air");
  const [shippingTime, setShippingTime] = useState("4:00 PM");
  const [materialsReceived, setMaterialsReceived] = useState("");
  const [caseShade, setCaseShade] = useState("");
  const [softTissueShade, setSoftTissueShade] = useState("");
  const [metalSelection, setMetalSelection] = useState("None");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [caseItems, setCaseItems] = useState<CaseItemRow[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [importingInbox, setImportingInbox] = useState(false);
  const [importedInboxLabel, setImportedInboxLabel] = useState("");
  const [importedInboxSummary, setImportedInboxSummary] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/technicians").then((response) => response.json()),
      fetch("/api/settings/lab").then((response) => response.json()),
      fetch("/api/accounts?limit=12").then((response) => response.json()),
    ])
      .then(([techData, labData, accountData]) => {
        setTechnicians(Array.isArray(techData) ? techData : []);
        setServiceProducts(
          Array.isArray(labData.products)
            ? labData.products.filter((product: ServiceProduct) => product.isActive)
            : []
        );
        const initialAccounts = Array.isArray(accountData) ? accountData : [];
        setAccounts(initialAccounts);
        setAccountResults(initialAccounts);
      })
      .catch(() => {
        setTechnicians([]);
        setServiceProducts([]);
        setAccounts([]);
        setAccountResults([]);
      });
  }, []);

  useEffect(() => {
    const query = accountSearch.trim();
    if (query.length < 2) {
      setLoadingAccounts(false);
      setAccountResults(accounts.slice(0, 8));
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
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
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
  }, [accountSearch, accounts]);

  const serviceTree = useMemo(() => {
    if (!serviceProducts.length) return FALLBACK_SERVICE_TREE;
    return serviceProducts.reduce<Record<string, string[]>>((tree, product) => {
      tree[product.department] = tree[product.department] ?? [];
      tree[product.department].push(product.name);
      return tree;
    }, {});
  }, [serviceProducts]);

  const selectedAccount = accounts.find((account) => account.id === dentalAccountId) ?? null;

  const patientName = [patientFirst.trim(), patientMI.trim() ? `${patientMI.trim()}.` : "", patientLast.trim()]
    .filter(Boolean)
    .join(" ");

  const totalUnits = caseItems.reduce((sum, item) => sum + item.units, 0);
  const totalValue = caseItems.reduce((sum, item) => sum + item.units * item.price, 0);
  const totalTeeth = Array.from(
    new Set(caseItems.flatMap((item) => item.selectedTeeth))
  ).length;

  const reviewItems = caseItems.map((item) => ({
    ...item,
    toothNumbers: item.selectedTeeth.length
      ? [...item.selectedTeeth].sort((a, b) => a - b).join(", ")
      : "Arch / not selected",
  }));

  const canMovePatientStep =
    Boolean(dentalAccountId) && Boolean(patientFirst.trim()) && Boolean(patientLast.trim());
  const canMoveRxStep = caseItems.length > 0;

  function appendDraftAttachments(nextAttachments: ImportedInboxAttachment[]) {
    setDraftAttachments((current) => {
      const existingKeys = new Set(current.map((attachment) => `${attachment.file.name}:${attachment.file.size}`));
      const incoming = nextAttachments
        .filter((attachment) => !existingKeys.has(`${attachment.file.name}:${attachment.file.size}`))
        .map((attachment) => ({
          id: `${attachment.file.name}-${attachment.file.size}-${Math.random()}`,
          file: attachment.file,
          fileType: attachment.fileType,
        }));
      return [...current, ...incoming];
    });
  }

  const onAttachmentDrop = useCallback((acceptedFiles: File[]) => {
    appendDraftAttachments(
      acceptedFiles.map((file) => ({
        file,
        fileType: inferClientAttachmentType(file),
      }))
    );
  }, []);

  const onInboxArchiveDrop = useCallback(async (acceptedFiles: File[]) => {
    const archive = acceptedFiles[0];
    if (!archive) return;

    setImportingInbox(true);
    setError("");

    try {
      const imported = await parseLabInboxArchive(archive);

      if (imported.patientFirst) setPatientFirst(imported.patientFirst);
      if (imported.patientLast) setPatientLast(imported.patientLast);
      if (imported.toothNumbers.length > 0 && caseItems.length === 0) {
        setCaseItems([
          {
            ...makeItem("Imported Digital Rx", "Imported"),
            selectedTeeth: imported.toothNumbers,
          },
        ]);
      }

      if (imported.metadataSummary.length > 0) {
        setInternalNotes((current) => {
          const prefix = `Imported from ${archive.name}`;
          const summary = `Metadata files: ${imported.metadataSummary.join(", ")}`;
          const nextBlock = [prefix, summary].join("\n");
          return current.includes(nextBlock) ? current : [current.trim(), nextBlock].filter(Boolean).join("\n\n");
        });
      }

      appendDraftAttachments(imported.attachments);
      setImportedInboxLabel(imported.sourceLabel);
      setImportedInboxSummary([
        imported.patientName ? `Patient: ${imported.patientName}` : "Patient: not detected",
        imported.toothNumbers.length > 0
          ? `Teeth: ${imported.toothNumbers.join(", ")}`
          : "Teeth: not detected",
        imported.attachments.length > 0
          ? `Files staged: ${imported.attachments.length}`
          : "Files staged: 0",
      ]);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Failed to parse lab archive.");
    } finally {
      setImportingInbox(false);
    }
  }, [caseItems.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_ATTACHMENT_TYPES,
    maxSize: MAX_ATTACHMENT_SIZE_BYTES,
    onDrop: onAttachmentDrop,
  });

  const {
    getRootProps: getInboxRootProps,
    getInputProps: getInboxInputProps,
    isDragActive: isInboxDragActive,
  } = useDropzone({
    accept: ACCEPTED_INBOX_ARCHIVE_TYPES,
    maxFiles: 1,
    maxSize: MAX_INBOX_ARCHIVE_SIZE_BYTES,
    onDrop: (files) => {
      void onInboxArchiveDrop(files);
    },
  });

  function selectAccount(account: DentalAccount) {
    setDentalAccountId(account.id);
    setAccountSearch(`${account.name}${account.doctorName ? ` - Dr. ${account.doctorName}` : ""}`);
    setShowAccountResults(false);
    const addressParts = [account.address, account.city, account.state, account.zip].filter(Boolean);
    if (addressParts.length) setShippingAddress(addressParts.join(", "));
  }

  function addItem(productType: string, department: string) {
    const catalogItem = serviceProducts.find(
      (product) => product.department === department && product.name === productType
    );
    setCaseItems((items) => [...items, makeItem(productType, department, Number(catalogItem?.defaultPrice ?? 0))]);
  }

  function updateItem(localId: string, patch: Partial<CaseItemRow>) {
    setCaseItems((items) => items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  }

  function removeItem(localId: string) {
    setCaseItems((items) => items.filter((item) => item.localId !== localId));
  }

  function validateStep(step: StepKey) {
    if (step === "patient" && !canMovePatientStep) {
      setError("Select an account and enter patient first and last name.");
      return false;
    }
    if (step === "rx" && !canMoveRxStep) {
      setError("Add at least one service before moving on.");
      return false;
    }
    setError("");
    return true;
  }

  function goNext() {
    const index = STEP_ORDER.findIndex((step) => step.key === currentStep);
    if (!validateStep(currentStep)) return;
    const nextStep = STEP_ORDER[index + 1];
    if (nextStep) setCurrentStep(nextStep.key);
  }

  function goBack() {
    const index = STEP_ORDER.findIndex((step) => step.key === currentStep);
    const previousStep = STEP_ORDER[index - 1];
    if (previousStep) setCurrentStep(previousStep.key);
  }

  async function uploadDraftFiles(caseId: string, caseNumber: string) {
    if (!draftAttachments.length) return;

    for (let index = 0; index < draftAttachments.length; index += 1) {
      const attachment = draftAttachments[index];
      await upload(`cases/${caseNumber}/${attachment.file.name}`, attachment.file, {
        access: "public",
        handleUploadUrl: `/api/cases/${caseId}/attachments/upload`,
        clientPayload: JSON.stringify({
          caseId,
          originalName: attachment.file.name,
          fileType: attachment.fileType,
        }),
        onUploadProgress: (event) => {
          const base = (index / draftAttachments.length) * 100;
          const portion = event.percentage / draftAttachments.length;
          setUploadProgress(Math.min(100, Math.round(base + portion)));
        },
      });
    }
  }

  async function saveCase() {
    setError("");

    if (!validateStep("patient") || !validateStep("rx")) {
      return;
    }

    setSaving(true);
    setUploadProgress(draftAttachments.length ? 0 : null);

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
          selectedTeeth: totalTeeth
            ? JSON.stringify(Array.from(new Set(caseItems.flatMap((item) => item.selectedTeeth))))
            : null,
          missingTeeth: JSON.stringify(Array.from(new Set(caseItems.flatMap((item) => item.missingTeeth)))),
          notes: notes || null,
          internalNotes: internalNotes || null,
          materialsReceived: materialsReceived || null,
          shippingAddress: shippingAddress || null,
          shippingCarrier: shippingCarrier || null,
          shippingTime: shippingTime || null,
          generateSchedule,
          items: caseItems.map((item) => ({
            productType: item.productType,
            toothNumbers: item.selectedTeeth.length
              ? [...item.selectedTeeth].sort((a, b) => a - b).join(", ")
              : null,
            units: item.units,
            shade: item.shade || caseShade || null,
            material: item.material !== "None" ? item.material : null,
            notes: item.department || null,
            price: item.price,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Failed to create case.");
        return;
      }

      const created = await response.json();
      await uploadDraftFiles(created.id, created.caseNumber);
      router.push(`/cases/${created.caseNumber}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Case creation failed.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <Link href="/incoming" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to incoming
          </Link>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-sky-300" />
            <div>
              <h1 className="text-base font-bold text-white">New Case / Order</h1>
              <p className="text-xs text-slate-400">{patientName || "Draft case"}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {uploadProgress !== null ? (
              <span className="rounded-full border border-sky-700 bg-sky-950 px-3 py-1 text-xs text-sky-200">
                Uploading {uploadProgress}%
              </span>
            ) : null}
            <button
              type="button"
              onClick={saveCase}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create Case
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="grid gap-3 lg:grid-cols-4">
            {STEP_ORDER.map((step, index) => {
              const currentIndex = STEP_ORDER.findIndex((entry) => entry.key === currentStep);
              const state =
                index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    if (index <= currentIndex || validateStep(currentStep)) {
                      setCurrentStep(step.key);
                    }
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    state === "current"
                      ? "border-sky-500 bg-sky-950/50"
                      : state === "done"
                        ? "border-emerald-700 bg-emerald-950/30"
                        : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        state === "current"
                          ? "bg-sky-500 text-white"
                          : state === "done"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="text-sm font-semibold text-white">{step.title}</span>
                  </div>
                  <p className="text-xs text-slate-400">{step.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {currentStep === "patient" && (
              <>
                <Panel title="Doctor & Account" description="Pick the doctor, receiving practice, and delivery defaults.">
                  <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
                    <div className="relative">
                      <FieldLabel>Account / Doctor Search</FieldLabel>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <input
                          value={accountSearch}
                          onChange={(event) => {
                            setAccountSearch(event.target.value);
                            setShowAccountResults(true);
                          }}
                          onFocus={() => setShowAccountResults(true)}
                          placeholder="Type 2+ characters to search"
                          className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
                        />
                      </div>
                      {showAccountResults && (
                        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
                          {loadingAccounts ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-300">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Searching accounts...
                            </div>
                          ) : accountResults.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-slate-400">No matching accounts found.</div>
                          ) : (
                            accountResults.map((account) => (
                              <button
                                key={account.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectAccount(account)}
                                className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-sky-950"
                              >
                                <span className="font-semibold">{account.name}</span>
                                {account.doctorName ? <span className="text-slate-400"> - Dr. {account.doctorName}</span> : null}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <FieldLabel>Pan Number</FieldLabel>
                      <TextInput value={pan} onChange={setPan} placeholder="Pan #" />
                    </div>
                  </div>

                  {selectedAccount ? (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <div className="font-semibold text-white">{selectedAccount.name}</div>
                      <div className="text-slate-400">
                        {selectedAccount.doctorName ? `Dr. ${selectedAccount.doctorName}` : "No doctor listed"}
                      </div>
                    </div>
                  ) : null}
                </Panel>

                <Panel
                  title="Digital Inbox Import"
                  description="Drop an iTero, 3Shape, or other lab archive here and we'll prefill what we can instead of retyping it."
                >
                  <div
                    {...getInboxRootProps()}
                    className={`flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition ${
                      isInboxDragActive
                        ? "border-sky-400 bg-sky-950/40"
                        : "border-slate-700 bg-slate-950/70 hover:border-slate-500"
                    }`}
                  >
                    <input {...getInboxInputProps()} />
                    {importingInbox ? (
                      <Loader2 className="mb-3 h-8 w-8 animate-spin text-sky-300" />
                    ) : (
                      <UploadCloud className="mb-3 h-8 w-8 text-sky-300" />
                    )}
                    <p className="text-sm font-semibold text-white">
                      {importingInbox
                        ? "Reading archive..."
                        : isInboxDragActive
                          ? "Drop the archive here"
                          : "Drag a vendor ZIP here or click to browse"}
                    </p>
                    <p className="mt-2 max-w-2xl text-xs text-slate-500">
                      We look for patient metadata, tooth numbers, and embedded STL/PDF/image files, then stage them into this case draft.
                    </p>
                  </div>

                  {importedInboxLabel ? (
                    <div className="mt-4 rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-100">
                        <CheckCircle2 className="h-4 w-4" />
                        Imported from {importedInboxLabel}
                      </div>
                      <ul className="space-y-1 text-xs text-emerald-200/90">
                        {importedInboxSummary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Panel>

                <Panel title="Patient Details" description="This is the part we really don't want to lose to an accidental modal close.">
                  <div className="grid gap-4 md:grid-cols-[1fr_90px_1fr_100px_160px]">
                    <div>
                      <FieldLabel>First Name</FieldLabel>
                      <TextInput value={patientFirst} onChange={setPatientFirst} />
                    </div>
                    <div>
                      <FieldLabel>MI</FieldLabel>
                      <TextInput value={patientMI} onChange={(value) => setPatientMI(value.slice(0, 1).toUpperCase())} />
                    </div>
                    <div>
                      <FieldLabel>Last Name</FieldLabel>
                      <TextInput value={patientLast} onChange={setPatientLast} />
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

                <Panel title="Delivery Defaults" description="Shipping route, time, and where the work is going.">
                  <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_180px]">
                    <div>
                      <FieldLabel>Ship To</FieldLabel>
                      <TextInput value={shippingAddress} onChange={setShippingAddress} placeholder="Shipping address" />
                    </div>
                    <div>
                      <FieldLabel>Technician</FieldLabel>
                      <SelectInput value={technicianId} onChange={setTechnicianId}>
                        <option value="">Unassigned</option>
                        {technicians.map((technician) => (
                          <option key={technician.id} value={technician.id}>
                            {technician.name}
                          </option>
                        ))}
                      </SelectInput>
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
                </Panel>
              </>
            )}

            {currentStep === "rx" && (
              <>
                <Panel title="Case Setup" description="The prescription details and service mix for this case.">
                  <div className="grid gap-4 lg:grid-cols-4">
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
                            className={`h-10 rounded-lg border text-sm font-semibold ${
                              caseType === value
                                ? "border-sky-400 bg-sky-600 text-white"
                                : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Priority</FieldLabel>
                      <SelectInput value={priority} onChange={(value) => setPriority(value as "NORMAL" | "RUSH" | "STAT")}>
                        <option value="NORMAL">Normal</option>
                        <option value="RUSH">Rush</option>
                        <option value="STAT">Stat</option>
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Received Date</FieldLabel>
                      <TextInput value={receivedDate} onChange={setReceivedDate} type="date" />
                    </div>
                    <div>
                      <FieldLabel>Due Date</FieldLabel>
                      <TextInput value={dueDate} onChange={setDueDate} type="date" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-5">
                    <Checkbox
                      checked={rushOrder}
                      onChange={(checked) => {
                        setRushOrder(checked);
                        setPriority(checked ? "RUSH" : "NORMAL");
                      }}
                      label="Rush Order"
                    />
                    <Checkbox checked={tryIn} onChange={setTryIn} label="Try-In Required" />
                    <Checkbox checked={caseGuarantee} onChange={setCaseGuarantee} label="Guarantee" />
                    <Checkbox checked={generateSchedule} onChange={setGenerateSchedule} label="Generate Schedule" />
                  </div>

                  {tryIn ? (
                    <div className="mt-4 max-w-48">
                      <FieldLabel>Try-In Lead Days</FieldLabel>
                      <TextInput value={tryInLeadDays} onChange={setTryInLeadDays} type="number" />
                    </div>
                  ) : null}
                </Panel>

                <Panel title="Services & Tooth Mapping" description="Each service line gets its own teeth so crowns and arches don't get mixed together.">
                  <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                      <div className="border-b border-slate-800 px-3 py-2">
                        <FieldLabel>Service Catalog</FieldLabel>
                        <p className="text-xs text-slate-500">Pick from your configured lab services.</p>
                      </div>
                      <div className="max-h-[700px] overflow-auto">
                        {Object.entries(serviceTree).map(([department, products]) => {
                          const open = expandedGroups[department];
                          return (
                            <div key={department}>
                              <button
                                type="button"
                                onClick={() => setExpandedGroups((groups) => ({ ...groups, [department]: !open }))}
                                className="flex w-full items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-yellow-200"
                              >
                                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {department}
                              </button>
                              {open && products.map((product) => (
                                <button
                                  key={product}
                                  type="button"
                                  onClick={() => addItem(product, department)}
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
                      {caseItems.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/60 text-center text-slate-500">
                          <PackagePlus className="mb-3 h-8 w-8" />
                          <p className="text-sm">Choose a service from the catalog to start the prescription.</p>
                        </div>
                      ) : (
                        caseItems.map((item, index) => (
                          <div key={item.localId} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.productType}</p>
                                <p className="text-xs text-slate-500">{item.department}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.localId)}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-slate-400 hover:border-red-500 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_80px_110px_120px_110px]">
                              <div>
                                <FieldLabel>Service</FieldLabel>
                                <TextInput value={item.productType} onChange={(value) => updateItem(item.localId, { productType: value })} />
                              </div>
                              <div>
                                <FieldLabel>Qty</FieldLabel>
                                <TextInput value={String(item.units)} onChange={(value) => updateItem(item.localId, { units: Math.max(1, Number(value) || 1) })} type="number" />
                              </div>
                              <div>
                                <FieldLabel>Shade</FieldLabel>
                                <TextInput value={item.shade} onChange={(value) => updateItem(item.localId, { shade: value })} />
                              </div>
                              <div>
                                <FieldLabel>Material</FieldLabel>
                                <SelectInput value={item.material} onChange={(value) => updateItem(item.localId, { material: value })}>
                                  {MATERIALS.map((material) => <option key={material}>{material}</option>)}
                                </SelectInput>
                              </div>
                              <div>
                                <FieldLabel>Price</FieldLabel>
                                <TextInput value={String(item.price)} onChange={(value) => updateItem(item.localId, { price: Number(value) || 0 })} type="number" />
                              </div>
                            </div>

                            <div className="mb-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => updateItem(item.localId, { selectedTeeth: Array.from({ length: 16 }, (_, toothIndex) => toothIndex + 1) })}
                                className="h-8 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                              >
                                Upper Arch
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(item.localId, { selectedTeeth: Array.from({ length: 16 }, (_, toothIndex) => toothIndex + 17) })}
                                className="h-8 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                              >
                                Lower Arch
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(item.localId, { selectedTeeth: [], missingTeeth: [] })}
                                className="h-8 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
                              >
                                Clear
                              </button>
                            </div>

                            <ToothDiagram
                              selected={item.selectedTeeth}
                              missing={item.missingTeeth}
                              onChange={(selected, missing) => updateItem(item.localId, { selectedTeeth: selected, missingTeeth: missing })}
                            />

                            <p className="mt-3 text-xs text-slate-500">
                              Line {index + 1}: {item.selectedTeeth.length ? [...item.selectedTeeth].sort((a, b) => a - b).join(", ") : "No teeth selected yet"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel title="Materials & Notes" description="Keep supporting RX details close to the services they affect.">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <FieldLabel>Material Received</FieldLabel>
                        <textarea
                          value={materialsReceived}
                          onChange={(event) => setMaterialsReceived(event.target.value)}
                          className="h-28 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </div>
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
                    <div className="space-y-4">
                      <div>
                        <FieldLabel>Case Shade</FieldLabel>
                        <div className="grid grid-cols-4 gap-2">
                          {SHADE_SWATCHES.map((shade) => (
                            <button
                              key={shade}
                              type="button"
                              onClick={() => setCaseShade(shade)}
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
                        <FieldLabel>Doctor / Case Notes</FieldLabel>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          className="h-28 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </div>
                      <div>
                        <FieldLabel>Internal Notes</FieldLabel>
                        <textarea
                          value={internalNotes}
                          onChange={(event) => setInternalNotes(event.target.value)}
                          className="h-28 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </div>
                    </div>
                  </div>
                </Panel>
              </>
            )}

            {currentStep === "attachments" && (
              <Panel title="Attachments" description="Add STLs, RX PDFs, and photos before the case is created. We'll upload them right after the case saves.">
                <div
                  {...getRootProps()}
                  className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition ${
                    isDragActive
                      ? "border-sky-400 bg-sky-950/40"
                      : "border-slate-700 bg-slate-950/70 hover:border-slate-500"
                  }`}
                >
                  <input {...getInputProps()} />
                  <UploadCloud className="mb-3 h-8 w-8 text-sky-300" />
                  <p className="text-sm font-semibold text-white">
                    {isDragActive ? "Drop files here" : "Drag files here or click to browse"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    STL, PDF, JPG, PNG, WEBP up to 50MB each
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {draftAttachments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
                      No draft attachments yet.
                    </div>
                  ) : (
                    draftAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{attachment.file.name}</p>
                          <p className="text-xs text-slate-500">
                            {attachment.fileType.toUpperCase()} · {(attachment.file.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraftAttachments((current) => current.filter((candidate) => candidate.id !== attachment.id))}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-slate-400 hover:border-red-500 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            )}

            {currentStep === "review" && (
              <Panel title="Review & Create" description="Final checkpoint before the case is written and files are uploaded.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <UserRound className="h-4 w-4 text-sky-300" />
                      Patient & Doctor
                    </h3>
                    <div className="space-y-2 text-sm text-slate-300">
                      <div><span className="text-slate-500">Account:</span> {selectedAccount?.name ?? "Not selected"}</div>
                      <div><span className="text-slate-500">Patient:</span> {patientName || "Missing patient name"}</div>
                      <div><span className="text-slate-500">Pan:</span> {pan || "None"}</div>
                      <div><span className="text-slate-500">Ship:</span> {shippingCarrier} at {shippingTime}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck className="h-4 w-4 text-sky-300" />
                      Prescription
                    </h3>
                    <div className="space-y-2 text-sm text-slate-300">
                      <div><span className="text-slate-500">Case Type:</span> {caseType}</div>
                      <div><span className="text-slate-500">Priority:</span> {priority}</div>
                      <div><span className="text-slate-500">Due Date:</span> {dueDate || "Not set"}</div>
                      <div><span className="text-slate-500">Attachments:</span> {draftAttachments.length}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Service Lines</h3>
                  <div className="space-y-3">
                    {reviewItems.map((item) => (
                      <div key={item.localId} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{item.productType}</p>
                            <p className="text-xs text-slate-500">{item.department}</p>
                          </div>
                          <div className="text-sm text-slate-300">
                            {item.units} unit(s) · ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">Teeth: {item.toothNumbers}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            )}

            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={currentStep === "patient" || saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-900 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              {currentStep !== "review" ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveCase}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create Case
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <Panel title="Draft Summary" description="A calmer summary rail than stuffing everything into one modal viewport.">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex justify-between"><span className="text-slate-500">Patient</span><span>{patientName || "Draft"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Services</span><span>{caseItems.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Units</span><span>{totalUnits}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Mapped Teeth</span><span>{totalTeeth}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Attachments</span><span>{draftAttachments.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Inbox Import</span><span>{importedInboxLabel || "None"}</span></div>
                <div className="flex justify-between border-t border-slate-800 pt-3 font-semibold text-white">
                  <span>Estimated Total</span>
                  <span>${totalValue.toFixed(2)}</span>
                </div>
              </div>
            </Panel>

            <Panel title="Why this flow" description="The point is to make the work feel recoverable and legible.">
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Step-by-step entry reduces the modal cliff effect.</li>
                <li>Each service line keeps its own tooth mapping.</li>
                <li>Attachments are staged before save, then uploaded automatically.</li>
                <li>The review step gives technicians one final confidence pass.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
