"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import debounce from "lodash.debounce";
import { upload } from "@vercel/blob/client";
import { useDropzone } from "react-dropzone";
import type { STLAnnotation } from "@/components/ui/STLViewer";
import {
  ArrowLeft, ChevronDown, Save, RefreshCw, Plus, Send,
  CalendarDays, Clock, Package, Truck, User, Building2,
  FileText, Activity, Wrench, CheckCircle2, Circle,
  AlertCircle, Loader2, Hash, Printer, Link2, UploadCloud, MapPin,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import ToothDiagram from "@/components/ui/ToothDiagram";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

const STLViewer = dynamic(() => import("@/components/ui/STLViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-gray-700 bg-gray-950">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-sky-400" />
        Loading STL viewer...
      </div>
    </div>
  ),
});

/* ─── Types ─────────────────────────────────────────────────── */
interface CaseItem {
  id: string;
  productType: string;
  toothNumbers: string | null;
  units: number;
  shade: string | null;
  price: number;
  notes: string | null;
}

interface ScheduleStep {
  id: string;
  department: string;
  sortOrder: number;
  status: string;
  technicianId: string | null;
  technician: { id: string; name: string } | null;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
}

interface CaseNote {
  id: string;
  content: string;
  authorName: string;
  visibleToDoctor: boolean;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  authorName: string;
  createdAt: string;
}

interface FDALotEntry {
  id: string;
  caseItemId: string | null;
  itemName: string;
  manufacturer: string | null;
  lotNumber: string;
  userName: string;
  createdAt: string;
  caseItem?: {
    id: string;
    productType: string;
    toothNumbers: string | null;
  } | null;
}

interface AttachmentEntry {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  byteSize?: number | null;
  uploadedBy: string;
  createdAt: string;
}

interface ModelAnnotationEntry {
  id: string;
  attachmentId: string;
  x: number | string;
  y: number | string;
  z: number | string;
  color: string;
  label: string | null;
  authorName: string;
  createdAt: string;
  attachment?: {
    id: string;
    fileName: string;
    fileUrl: string;
  } | null;
  caseNote?: {
    id: string;
    content: string;
    authorName: string;
    visibleToDoctor: boolean;
    createdAt: string;
  } | null;
}

interface Technician {
  id: string;
  name: string;
  specialty: string | null;
}

interface CaseDetail {
  id: string;
  caseNumber: string;
  patientName: string;
  patientFirst: string | null;
  patientMI: string | null;
  patientLast: string | null;
  patientAge: number | null;
  patientGender: string | null;
  status: string;
  priority: string;
  caseType: string;
  caseOrigin: string;
  route: string;
  rushOrder: boolean;
  pan: string | null;
  shade: string | null;
  softTissueShade: string | null;
  metalSelection: string | null;
  selectedTeeth: string | null;
  missingTeeth: string | null;
  materialsReceived: string | null;
  notes: string | null;
  internalNotes: string | null;
  totalValue: number;
  isPaid: boolean;
  receivedDate: string;
  dueDate: string | null;
  shippedDate: string | null;
  shippingCarrier: string | null;
  shippingAddress: string | null;
  dentalAccount: { id: string; name: string; doctorName: string | null; phone: string | null; city: string | null; state: string | null };
  technician: { id: string; name: string } | null;
  items: CaseItem[];
  caseNotes: CaseNote[];
  schedule: ScheduleStep[];
  audits: AuditEntry[];
  fdaLots?: FDALotEntry[];
  attachments?: AttachmentEntry[];
  modelAnnotations?: ModelAnnotationEntry[];
}

/* ─── Helpers ───────────────────────────────────────────────── */
const STEP_STATUS_OPTIONS = ["SCHEDULED", "READY", "IN_PROCESS", "COMPLETE"] as const;
type StepStatus = typeof STEP_STATUS_OPTIONS[number]; // eslint-disable-line @typescript-eslint/no-unused-vars

const STEP_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-gray-700/60 text-gray-400 border-gray-600",
  READY:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_PROCESS: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  COMPLETE:   "bg-green-500/20 text-green-400 border-green-500/30",
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  SCHEDULED:  <Circle className="w-3.5 h-3.5" />,
  READY:      <AlertCircle className="w-3.5 h-3.5" />,
  IN_PROCESS: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  COMPLETE:   <CheckCircle2 className="w-3.5 h-3.5" />,
};

const ROUTE_LABELS: Record<string, string> = {
  LOCAL: "Local",
  UPS_GROUND: "UPS Ground",
  UPS_2DAY: "UPS 2nd Day",
  FEDEX: "FedEx",
};

const ACTION_LABELS: Record<string, string> = {
  CASE_CREATED:        "Case Created",
  CASE_UPDATED:        "Case Updated",
  NOTE_ADDED:          "Note Added",
  SCHEDULE_GENERATED:  "Schedule Generated",
  SCHEDULE_UPDATED:    "Schedule Updated",
  TECH_CHECKIN:        "Tech Checked In",
  TECH_CHECKOUT:       "Tech Checked Out",
  ATTACHMENT_ADDED:    "Attachment Added",
  FDA_LOT_ADDED:       "FDA Lot Added",
};

function InfoCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-medium text-white">{value || "—"}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-sky-400" />
      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">{title}</h2>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function formatCaseItemLabel(item: Pick<CaseItem, "productType" | "toothNumbers">) {
  return item.toothNumbers
    ? `${item.productType} (${item.toothNumbers})`
    : item.productType;
}

const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

const ACCEPTED_ATTACHMENT_TYPES = {
  "application/pdf": [".pdf"],
  "application/octet-stream": [".3mf", ".obj", ".ply", ".stl"],
  "application/sla": [".stl"],
  "application/vnd.ms-pki.stl": [".stl"],
  "image/bmp": [".bmp"],
  "image/gif": [".gif"],
  "image/heic": [".heic"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/tiff": [".tif", ".tiff"],
  "image/webp": [".webp"],
  "model/stl": [".stl"],
} as const;

function inferClientAttachmentType(file: File): AttachmentEntry["fileType"] {
  const normalizedName = file.name.toLowerCase();
  const normalizedMime = file.type.toLowerCase();

  if (
    normalizedMime.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic"].some((ext) =>
      normalizedName.endsWith(ext)
    )
  ) {
    return "image";
  }

  if (normalizedMime === "application/pdf" || normalizedName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    normalizedMime.includes("stl") ||
    [".stl", ".3mf", ".obj", ".ply"].some((ext) => normalizedName.endsWith(ext))
  ) {
    return "stl";
  }

  return "other";
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  const [editStatus, setEditStatus] = useState("");
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [missingTeeth, setMissingTeeth] = useState<number[]>([]);
  const [shade, setShade] = useState("");
  const [softTissueShade, setSoftTissueShade] = useState("");
  const [metalSelection, setMetalSelection] = useState("");
  const [materialsReceived, setMaterialsReceived] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [newNote, setNewNote] = useState("");
  const [newNoteVisibleToDoctor, setNewNoteVisibleToDoctor] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [fdaCaseItemId, setFdaCaseItemId] = useState("");
  const [fdaItemName, setFdaItemName] = useState("");
  const [fdaManufacturer, setFdaManufacturer] = useState("");
  const [fdaLotNumber, setFdaLotNumber] = useState("");
  const [submittingFdaLot, setSubmittingFdaLot] = useState(false);
  const [submittingAttachment, setSubmittingAttachment] = useState(false);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [attachmentProgress, setAttachmentProgress] = useState<number | null>(null);
  const [selectedStlUrl, setSelectedStlUrl] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState("");
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [annotationColor, setAnnotationColor] = useState("#f59e0b");
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationVisibleToDoctor, setAnnotationVisibleToDoctor] = useState(false);
  const [submittingAnnotation, setSubmittingAnnotation] = useState(false);
  const hasInitializedAutosaveRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");

  const autoSavePayload = useMemo(() => ({
    status: editStatus,
    shade: shade || null,
    softTissueShade: softTissueShade || null,
    metalSelection: metalSelection || null,
    materialsReceived: materialsReceived || null,
    internalNotes: internalNotes || null,
    selectedTeeth: JSON.stringify(selectedTeeth),
    missingTeeth: JSON.stringify(missingTeeth),
  }), [
    editStatus,
    shade,
    softTissueShade,
    metalSelection,
    materialsReceived,
    internalNotes,
    selectedTeeth,
    missingTeeth,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [caseRes, techRes] = await Promise.all([
        fetch(`/api/cases/${id}`),
        fetch("/api/technicians"),
      ]);

      if (!caseRes.ok) {
        const errorData = await caseRes.json().catch(() => null);
        throw new Error(errorData?.error ?? "Case could not be loaded.");
      }

      const c: CaseDetail = await caseRes.json();
      const t: Technician[] = techRes.ok ? await techRes.json() : [];

      setCaseData(c);
      setTechnicians(Array.isArray(t) ? t : []);
      setEditStatus(c.status);
      setSelectedTeeth(c.selectedTeeth ? JSON.parse(c.selectedTeeth) : []);
      setMissingTeeth(c.missingTeeth ? JSON.parse(c.missingTeeth) : []);
      setShade(c.shade ?? "");
      setSoftTissueShade(c.softTissueShade ?? "");
      setMetalSelection(c.metalSelection ?? "");
      setMaterialsReceived(c.materialsReceived ?? "");
      setInternalNotes(c.internalNotes ?? "");
      lastSavedSnapshotRef.current = JSON.stringify({
        status: c.status,
        shade: c.shade ?? null,
        softTissueShade: c.softTissueShade ?? null,
        metalSelection: c.metalSelection ?? null,
        materialsReceived: c.materialsReceived ?? null,
        internalNotes: c.internalNotes ?? null,
        selectedTeeth: c.selectedTeeth ?? "[]",
        missingTeeth: c.missingTeeth ?? "[]",
      });
      hasInitializedAutosaveRef.current = true;
      setSaveState("idle");
    } catch (error) {
      setCaseData(null);
      setTechnicians([]);
      setLoadError(error instanceof Error ? error.message : "Case could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const stlAttachments =
      caseData?.attachments?.filter(
        (attachment) =>
          attachment.fileType.toLowerCase() === "stl" ||
          attachment.fileUrl.toLowerCase().endsWith(".stl")
      ) ?? [];

    if (!stlAttachments.length) {
      if (selectedStlUrl) {
        setSelectedStlUrl("");
      }
      return;
    }

    const selectedStillExists = stlAttachments.some((attachment) => attachment.fileUrl === selectedStlUrl);
    if (!selectedStlUrl || !selectedStillExists) {
      setSelectedStlUrl(stlAttachments[0].fileUrl);
    }
  }, [caseData?.attachments, selectedStlUrl]);

  useEffect(() => {
    if (!caseData?.modelAnnotations?.length) {
      if (selectedAnnotationId) {
        setSelectedAnnotationId("");
      }
      return;
    }

    const annotationStillExists = caseData.modelAnnotations.some(
      (annotation) => annotation.id === selectedAnnotationId
    );
    if (!annotationStillExists && selectedAnnotationId) {
      setSelectedAnnotationId("");
    }
  }, [caseData?.modelAnnotations, selectedAnnotationId]);

  useEffect(() => {
    if (!caseData?.modelAnnotations?.length || !selectedStlUrl || !selectedAnnotationId) {
      return;
    }

    const selectedAttachment = caseData.attachments?.find(
      (attachment) => attachment.fileUrl === selectedStlUrl
    );

    const annotationStillVisible = caseData.modelAnnotations.some(
      (annotation) =>
        annotation.id === selectedAnnotationId && annotation.attachmentId === selectedAttachment?.id
    );

    if (!annotationStillVisible) {
      setSelectedAnnotationId("");
    }
  }, [caseData?.attachments, caseData?.modelAnnotations, selectedAnnotationId, selectedStlUrl]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedAutoSave = useMemo(
    () =>
      debounce((payload: typeof autoSavePayload) => {
        void saveCase(payload, false);
      }, 1000),
    [saveCase]
  );

  useEffect(() => {
    if (!hasInitializedAutosaveRef.current || !caseData) return;

    const snapshot = JSON.stringify(autoSavePayload);
    if (snapshot === lastSavedSnapshotRef.current) return;

    setSaveState("saving");
    debouncedAutoSave(autoSavePayload);

    return () => {
      debouncedAutoSave.cancel();
    };
  }, [autoSavePayload, caseData, debouncedAutoSave]);

  useEffect(() => {
    if (saveState !== "saved") return;

    const timeoutId = window.setTimeout(() => setSaveState("idle"), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  useEffect(() => {
    return () => {
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

  /* ─── Save case fields ───────────────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function saveCase(payload = autoSavePayload, showSuccessToast = false) {
    setSaving(true);
    setSaveState("saving");

    try {
      const response = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? "Case could not be saved.");
      }

      const updatedCase: CaseDetail = await response.json();
      setCaseData(updatedCase);
      lastSavedSnapshotRef.current = JSON.stringify(payload);
      setSaveState("saved");

      if (showSuccessToast) {
        toast.success("Case saved");
      }
    } catch (error) {
      setSaveState("error");
      toast.error(error instanceof Error ? error.message : "Case could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Schedule step update ───────────────────────────────── */
  const updateStep = async (stepId: string, field: string, value: string) => {
    try {
      const response = await fetch(`/api/cases/${id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stepId, [field]: value }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? "Schedule step could not be updated.");
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schedule step could not be updated.");
    }
  };

  /* ─── Generate schedule ──────────────────────────────────── */
  const generateSchedule = async () => {
    setGeneratingSchedule(true);
    try {
      const response = await fetch(`/api/cases/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? "Schedule could not be generated.");
      }

      await load();
      toast.success("Schedule generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schedule could not be generated.");
    } finally {
      setGeneratingSchedule(false);
    }
  };

  /* ─── Add note ───────────────────────────────────────────── */
  const submitNote = async () => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    await fetch(`/api/cases/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: newNote.trim(),
        visibleToDoctor: newNoteVisibleToDoctor,
      }),
    });
    setNewNote("");
    setNewNoteVisibleToDoctor(false);
    await load();
    setSubmittingNote(false);
  };

  const submitFdaLot = async () => {
    if (!fdaItemName.trim() || !fdaLotNumber.trim()) return;
    setSubmittingFdaLot(true);
    await fetch(`/api/cases/${id}/fda-lots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemName: fdaItemName.trim(),
        manufacturer: fdaManufacturer.trim() || null,
        lotNumber: fdaLotNumber.trim(),
        caseItemId: fdaCaseItemId || null,
      }),
    });
    setFdaCaseItemId("");
    setFdaItemName("");
    setFdaManufacturer("");
    setFdaLotNumber("");
    await load();
    setSubmittingFdaLot(false);
  };

  const submitModelAnnotation = useCallback(
    async (position: { x: number; y: number; z: number }) => {
      if (!caseData || !annotationDraft.trim()) return;

      const activeAttachment = caseData.attachments?.find(
        (attachment) => attachment.fileUrl === selectedStlUrl
      );

      if (!activeAttachment) {
        toast.error("Choose an STL file before adding an annotation.");
        return;
      }

      setSubmittingAnnotation(true);
      try {
        const response = await fetch(`/api/cases/${id}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attachmentId: activeAttachment.id,
            x: position.x,
            y: position.y,
            z: position.z,
            content: annotationDraft.trim(),
            color: annotationColor,
            label: annotationLabel.trim() || null,
            visibleToDoctor: annotationVisibleToDoctor,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error ?? "Annotation could not be saved.");
        }

        const created: ModelAnnotationEntry = await response.json();
        setSelectedAnnotationId(created.id);
        setAnnotationDraft("");
        setAnnotationLabel("");
        setAnnotationVisibleToDoctor(false);
        setAnnotationMode(false);
        await load();
        toast.success("Model annotation added");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Annotation could not be saved.");
      } finally {
        setSubmittingAnnotation(false);
      }
    },
    [
      annotationColor,
      annotationDraft,
      annotationLabel,
      annotationVisibleToDoctor,
      caseData,
      id,
      load,
      selectedStlUrl,
    ]
  );

  const submitAttachmentFiles = useCallback(async (files: File[]) => {
    if (!files.length || !caseData) return;

    setSubmittingAttachment(true);
    setAttachmentProgress(0);
    setAttachmentMessage("");

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const fileType = inferClientAttachmentType(file);

        await upload(`cases/${caseData.caseNumber}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: `/api/cases/${id}/attachments/upload`,
          clientPayload: JSON.stringify({
            caseId: caseData.id,
            originalName: file.name,
            fileType,
          }),
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => {
            const overall = ((index + percentage / 100) / files.length) * 100;
            setAttachmentProgress(Math.round(overall));
          },
        });
      }

      await load();
      setAttachmentProgress(100);
      setAttachmentMessage(files.length === 1 ? "Attachment uploaded." : `${files.length} attachments uploaded.`);
      toast.success(files.length === 1 ? "Attachment uploaded" : `${files.length} attachments uploaded`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Attachment upload could not be completed.";
      setAttachmentMessage(message);
      toast.error(message);
    } finally {
      setSubmittingAttachment(false);
      window.setTimeout(() => setAttachmentProgress(null), 1200);
    }
  }, [caseData, id, load]);

  const onAttachmentDrop = useCallback(async (acceptedFiles: File[]) => {
    await submitAttachmentFiles(acceptedFiles);
  }, [submitAttachmentFiles]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    onDrop: (acceptedFiles, fileRejections) => {
      if (fileRejections.length) {
        const tooLarge = fileRejections.some(({ errors }) =>
          errors.some((error) => error.code === "file-too-large")
        );

        setAttachmentMessage(
          tooLarge
            ? "Files larger than 50 MB need to be split or compressed before upload."
            : "Only STL, PDF, and image files can be dropped here."
        );
        return;
      }

      void onAttachmentDrop(acceptedFiles);
    },
    accept: ACCEPTED_ATTACHMENT_TYPES,
    disabled: submittingAttachment,
    maxSize: MAX_ATTACHMENT_SIZE_BYTES,
    multiple: true,
    noClick: true,
  });

  /* ─── Loading state ──────────────────────────────────────── */
  if (loading || !caseData) {
    if (!loading && !caseData) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 px-6">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800/60 p-6 text-center">
            <p className="text-lg font-semibold text-white">Case not available</p>
            <p className="mt-2 text-sm text-gray-400">{loadError || "We couldn't load this case."}</p>
            <button
              type="button"
              onClick={() => router.push("/incoming")}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
            >
              Back to Cases
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  const fullPatientName =
    [caseData.patientFirst, caseData.patientMI ? `${caseData.patientMI}.` : null, caseData.patientLast]
      .filter(Boolean)
      .join(" ") || caseData.patientName;
  const selectedFdaCaseItem = caseData.items.find((item) => item.id === fdaCaseItemId) ?? null;

  const hasSchedule = caseData.schedule.length > 0;
  const stlAttachments =
    caseData.attachments?.filter(
      (attachment) =>
        attachment.fileType.toLowerCase() === "stl" ||
        attachment.fileUrl.toLowerCase().endsWith(".stl")
    ) ?? [];

  const selectedStlAttachment =
    stlAttachments.find((attachment) => attachment.fileUrl === selectedStlUrl) ?? null;

  const stlAnnotations = (caseData.modelAnnotations ?? []).filter(
    (annotation) => annotation.attachmentId === selectedStlAttachment?.id
  );

  const viewerAnnotations: STLAnnotation[] = stlAnnotations.map((annotation) => ({
    id: annotation.id,
    x: Number(annotation.x),
    y: Number(annotation.y),
    z: Number(annotation.z),
    color: annotation.color,
    label: annotation.label,
    noteContent: annotation.caseNote?.content ?? null,
  }));

  return (
    <div className="min-h-screen bg-gray-900 pb-16">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#111827",
            color: "#f9fafb",
            border: "1px solid #374151",
          },
        }}
      />

      {/* ── Top header bar ── */}
      <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="h-4 w-px bg-gray-700" />

        {/* Case number */}
        <span className="font-mono text-sky-400 font-bold text-lg">{caseData.caseNumber}</span>

        {/* Status badge + editable dropdown */}
        <div className="relative">
          <select
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
            className={`appearance-none text-xs px-3 py-1.5 pr-7 rounded-full border font-semibold cursor-pointer focus:outline-none transition-all ${STATUS_COLORS[editStatus]}`}
          >
            {["INCOMING","IN_LAB","WIP","HOLD","REMAKE","COMPLETE","SHIPPED"].map((s) => (
              <option key={s} value={s} className="bg-gray-800 text-white">{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
        </div>

        {/* Priority badge */}
        {caseData.priority !== "NORMAL" && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PRIORITY_COLORS[caseData.priority]}`}>
            {caseData.priority}
          </span>
        )}
        {caseData.rushOrder && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold">RUSH</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className={`text-sm ${
            saveState === "saving"
              ? "text-amber-300"
              : saveState === "saved"
                ? "text-green-400"
                : saveState === "error"
                  ? "text-red-400"
                  : "text-gray-500"
          }`}>
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : "All changes saved"}
          </span>
          <span className="text-sm text-gray-400 hidden sm:block">
            Due: <span className={`font-medium ${caseData.dueDate && new Date(caseData.dueDate) < new Date() ? "text-red-400" : "text-white"}`}>{formatDate(caseData.dueDate)}</span>
          </span>
          <Link
            href={`/cases/${id}/workticket`}
            target="_blank"
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Work Ticket
          </Link>
          <button
            onClick={() => saveCase(autoSavePayload, true)}
            disabled={saving}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6 max-w-7xl mx-auto">

        {/* ── Info cards row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoCard
            label="Patient"
            icon={User}
            value={
              <div>
                <div>{fullPatientName}</div>
                {(caseData.patientAge || caseData.patientGender) && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[caseData.patientGender, caseData.patientAge ? `Age ${caseData.patientAge}` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            }
          />
          <InfoCard
            label="Account / Doctor"
            icon={Building2}
            value={
              <div>
                <div>{caseData.dentalAccount.name}</div>
                {caseData.dentalAccount.doctorName && (
                  <div className="text-xs text-gray-500 mt-0.5">Dr. {caseData.dentalAccount.doctorName}</div>
                )}
              </div>
            }
          />
          <InfoCard
            label="Pan Number"
            icon={Hash}
            value={caseData.pan ?? "—"}
          />
          <InfoCard
            label="Case Value"
            icon={Package}
            value={<span className="text-green-400">{formatCurrency(caseData.totalValue)}</span>}
          />
        </div>

        {/* ── Main two-column layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Left column (3/5) */}
          <div className="xl:col-span-3 space-y-6">

            {/* Case Details card */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader icon={FileText} title="Case Details" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Case Type</span>
                  <span className="font-medium text-white">{caseData.caseType ?? "NEW"}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Case Origin</span>
                  <span className="font-medium text-white">{caseData.caseOrigin ?? "LOCAL"}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Route</span>
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-medium text-white">{ROUTE_LABELS[caseData.route ?? "LOCAL"] ?? caseData.route}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Assigned Tech</span>
                  <span className="font-medium text-white">{caseData.technician?.name ?? "Unassigned"}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Received</span>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-medium text-white">{formatDate(caseData.receivedDate)}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Out of Lab</span>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                    <span className={`font-medium ${caseData.dueDate && new Date(caseData.dueDate) < new Date() ? "text-red-400" : "text-white"}`}>
                      {formatDate(caseData.dueDate)}
                    </span>
                  </div>
                </div>
                {caseData.shippedDate && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-0.5">Shipped</span>
                    <span className="font-medium text-teal-400">{formatDate(caseData.shippedDate)}</span>
                  </div>
                )}
                {caseData.shippingCarrier && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-0.5">Carrier</span>
                    <span className="font-medium text-white">{caseData.shippingCarrier}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Products / Items */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700/50">
                <SectionHeader icon={Package} title="Products" />
              </div>
              {caseData.items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500">No products on this case.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/30">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Teeth</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Shade</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/20">
                    {caseData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-700/20">
                        <td className="px-5 py-3 font-medium text-white">{item.productType}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{item.toothNumbers ?? "—"}</td>
                        <td className="px-3 py-3 text-center text-gray-300">{item.units}</td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{item.shade ?? "—"}</td>
                        <td className="px-5 py-3 text-right font-medium text-green-400">{formatCurrency(item.price * item.units)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-700/50 bg-gray-800/40">
                      <td colSpan={4} className="px-5 py-2.5 text-xs text-gray-500 text-right">Total</td>
                      <td className="px-5 py-2.5 text-right font-bold text-green-400">{formatCurrency(caseData.totalValue)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Shade / Material fields */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader icon={Package} title="Shade & Materials" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Shade Color</label>
                  <input
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    placeholder="e.g. A2, B1, C3"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Soft Tissue Shade</label>
                  <input
                    value={softTissueShade}
                    onChange={(e) => setSoftTissueShade(e.target.value)}
                    placeholder="e.g. ST-1, Pink"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Metal Selection</label>
                  <select
                    value={metalSelection}
                    onChange={(e) => setMetalSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="">— None / N/A —</option>
                    <option value="High Noble Yellow">High Noble Yellow</option>
                    <option value="High Noble White">High Noble White</option>
                    <option value="Noble">Noble</option>
                    <option value="Base Metal">Base Metal</option>
                    <option value="Titanium">Titanium</option>
                    <option value="Zirconia">Zirconia</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Materials Received</label>
                  <input
                    value={materialsReceived}
                    onChange={(e) => setMaterialsReceived(e.target.value)}
                    placeholder="e.g. Impression, Model, Bite"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Internal notes */}
              <div className="mt-4">
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Internal Notes</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  placeholder="Lab-only notes (not visible to client)…"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Case Notes */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader icon={FileText} title="Case Notes" />

              {/* Add note */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) submitNote(); }}
                    rows={2}
                    placeholder="Add a note… (⌘+Enter to submit)"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                  />
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={newNoteVisibleToDoctor}
                      onChange={(e) => setNewNoteVisibleToDoctor(e.target.checked)}
                      className="h-4 w-4 accent-sky-500"
                    />
                    Visible to doctor and notify by email/SMS
                  </label>
                </div>
                <button
                  onClick={submitNote}
                  disabled={submittingNote || !newNote.trim()}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg transition-colors self-end"
                >
                  {submittingNote ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              {/* Notes list */}
              <div className="space-y-3">
                {caseData.caseNotes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No notes yet.</p>
                ) : (
                  caseData.caseNotes.map((note) => (
                    <div key={note.id} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-sky-600/30 flex items-center justify-center">
                          <span className="text-sky-400 text-[9px] font-bold">{note.authorName[0]}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-300">{note.authorName}</span>
                        {note.visibleToDoctor && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            Doctor Visible
                          </span>
                        )}
                        <span className="text-xs text-gray-600 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(note.createdAt).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FDA Materials Tracking */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader icon={Activity} title="FDA Materials Tracking" />

              <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr_1fr_1fr_auto] gap-2 mb-4">
                <select
                  value={fdaCaseItemId}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setFdaCaseItemId(nextValue);
                    const nextItem = caseData.items.find((item) => item.id === nextValue);
                    if (nextItem) {
                      setFdaItemName(formatCaseItemLabel(nextItem));
                    }
                  }}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white transition-colors focus:border-sky-500 focus:outline-none"
                >
                  <option value="">Link to case item (optional)</option>
                  {caseData.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatCaseItemLabel(item)}
                    </option>
                  ))}
                </select>
                <input
                  value={fdaItemName}
                  onChange={(e) => setFdaItemName(e.target.value)}
                  placeholder={selectedFdaCaseItem ? formatCaseItemLabel(selectedFdaCaseItem) : "Item name (e.g. Zirconia Disc)"}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <input
                  value={fdaManufacturer}
                  onChange={(e) => setFdaManufacturer(e.target.value)}
                  placeholder="Manufacturer"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <input
                  value={fdaLotNumber}
                  onChange={(e) => setFdaLotNumber(e.target.value)}
                  placeholder="Lot number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  onClick={submitFdaLot}
                  disabled={submittingFdaLot || !fdaItemName.trim() || !fdaLotNumber.trim()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submittingFdaLot ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Add Lot"}
                </button>
              </div>

              {!caseData.fdaLots?.length ? (
                <p className="text-sm text-gray-500 text-center py-4">No FDA lot entries recorded for this case yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/30">
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Item</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Manufacturer</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Number</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Entered By</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/20">
                      {caseData.fdaLots.map((lot) => (
                        <tr key={lot.id} className="hover:bg-gray-700/10 transition-colors">
                          <td className="px-3 py-2.5 text-sm text-sky-300">
                            {lot.caseItem ? formatCaseItemLabel(lot.caseItem) : "Case-level"}
                          </td>
                          <td className="px-3 py-2.5 text-white font-medium">{lot.itemName}</td>
                          <td className="px-3 py-2.5 text-gray-400">{lot.manufacturer ?? "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-yellow-300">{lot.lotNumber}</td>
                          <td className="px-3 py-2.5 text-gray-400">{lot.userName}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{formatDate(lot.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader
                icon={Package}
                title="Attachments"
                action={(
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={submittingAttachment}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Upload File
                  </button>
                )}
              />

              <div
                {...getRootProps()}
                className={`mb-4 rounded-xl border border-dashed px-4 py-6 transition-colors ${
                  isDragActive
                    ? "border-sky-400 bg-sky-500/10"
                    : "border-gray-700 bg-gray-900/40 hover:border-gray-500"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {isDragActive ? "Drop files to attach them to this case" : "Drag STL files, PDFs, or RX images here"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Direct uploads go to case storage and automatically land in the audit trail. Max 50 MB per file.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={submittingAttachment}
                    className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
                  >
                    Browse Files
                  </button>
                </div>
              </div>

              {attachmentMessage && (
                <p className={`mb-4 text-sm ${attachmentMessage.toLowerCase().includes("uploaded") ? "text-green-400" : "text-amber-300"}`}>
                  {attachmentMessage}
                </p>
              )}

              {submittingAttachment && (
                <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-sky-200">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Uploading attachments...
                    </span>
                    <span>{attachmentProgress ?? 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${attachmentProgress ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              {stlAttachments.length > 0 && selectedStlUrl && (
                <div className="mb-4 rounded-xl border border-gray-700/50 bg-gray-900/60 p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      STL Preview
                    </span>
                    {stlAttachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        type="button"
                        onClick={() => setSelectedStlUrl(attachment.fileUrl)}
                        className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                          selectedStlUrl === attachment.fileUrl
                            ? "bg-sky-600 text-white"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        {attachment.fileName}
                      </button>
                    ))}
                  </div>

                  <div className="mb-3 grid gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <textarea
                          value={annotationDraft}
                          onChange={(e) => setAnnotationDraft(e.target.value)}
                          placeholder="Write the feedback you want tied to a pin on the model..."
                          className="min-h-[92px] w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                        />
                        <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/80 p-3">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                              Label
                            </label>
                            <input
                              value={annotationLabel}
                              onChange={(e) => setAnnotationLabel(e.target.value)}
                              placeholder="e.g. Margin"
                              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                              Pin Color
                            </label>
                            <input
                              type="color"
                              value={annotationColor}
                              onChange={(e) => setAnnotationColor(e.target.value)}
                              className="h-10 w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-950 p-1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={annotationVisibleToDoctor}
                            onChange={(e) => setAnnotationVisibleToDoctor(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-sky-500 focus:ring-sky-500"
                          />
                          Visible to doctor
                        </label>

                        <button
                          type="button"
                          onClick={() => setAnnotationMode((current) => !current)}
                          disabled={!annotationDraft.trim() || submittingAnnotation || !selectedStlAttachment}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            annotationMode
                              ? "bg-amber-600 text-white hover:bg-amber-500"
                              : "bg-sky-600 text-white hover:bg-sky-500"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {annotationMode ? "Cancel Pin Mode" : "Place Pin on Model"}
                        </button>

                        {annotationMode && (
                          <span className="text-xs text-amber-300">
                            Next click on the model will drop this comment.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                          Pins on this STL
                        </span>
                        <span className="text-xs text-gray-400">{stlAnnotations.length}</span>
                      </div>
                      {!stlAnnotations.length ? (
                        <p className="text-xs text-gray-500">
                          No annotation pins yet for this STL.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {stlAnnotations.map((annotation, index) => (
                            <button
                              key={annotation.id}
                              type="button"
                              onClick={() => setSelectedAnnotationId(annotation.id)}
                              className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                                selectedAnnotationId === annotation.id
                                  ? "border-sky-500/60 bg-sky-500/10"
                                  : "border-gray-800 bg-gray-950 hover:border-gray-700"
                              }`}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full border border-white/20"
                                  style={{ backgroundColor: annotation.color }}
                                />
                                <span className="text-xs font-semibold text-white">
                                  {annotation.label || `Pin ${index + 1}`}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400">
                                {annotation.caseNote?.content ?? "No note content"}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <STLViewer
                    fileUrl={selectedStlUrl}
                    className="h-[320px] w-full overflow-hidden rounded-xl border border-gray-700 bg-slate-950"
                    annotations={viewerAnnotations}
                    selectedAnnotationId={selectedAnnotationId || null}
                    annotationMode={annotationMode}
                    onAddAnnotation={(position) => void submitModelAnnotation(position)}
                    onSelectAnnotation={setSelectedAnnotationId}
                  />
                </div>
              )}

              {!caseData.attachments?.length ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/40 px-4 py-8 text-center">
                  <p className="text-sm text-gray-300">No attachments uploaded yet.</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Technicians can drag files here once Vercel Blob is connected for this project.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/30">
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">File</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Uploaded By</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Uploaded</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/20">
                      {caseData.attachments.map((attachment) => (
                        <tr key={attachment.id} className="hover:bg-gray-700/10 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-white">{attachment.fileName}</td>
                          <td className="px-3 py-2.5 uppercase text-gray-400">{attachment.fileType}</td>
                          <td className="px-3 py-2.5 text-gray-400">{attachment.uploadedBy}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{formatDate(attachment.createdAt)}</td>
                          <td className="px-3 py-2.5">
                            <a
                              href={attachment.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sky-400 transition-colors hover:text-sky-300"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right column (2/5) */}
          <div className="xl:col-span-2 space-y-6">

            {/* Tooth Diagram */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader icon={Activity} title="Tooth Diagram" />
              <ToothDiagram
                selected={selectedTeeth}
                missing={missingTeeth}
                onChange={(s, m) => { setSelectedTeeth(s); setMissingTeeth(m); }}
              />
            </div>

            {/* Department Schedule */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700/50 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Schedule</h2>
                {!hasSchedule && (
                  <button
                    onClick={generateSchedule}
                    disabled={generatingSchedule}
                    className="ml-auto flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {generatingSchedule
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <Plus className="w-3 h-3" />}
                    Generate Schedule
                  </button>
                )}
                {hasSchedule && (
                  <button
                    onClick={generateSchedule}
                    disabled={generatingSchedule}
                    title="Regenerate all steps"
                    className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${generatingSchedule ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                )}
              </div>

              {!hasSchedule ? (
                <div className="px-5 py-10 text-center">
                  <Wrench className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No schedule yet.</p>
                  <p className="text-xs text-gray-600 mt-1">Click &ldquo;Generate Schedule&rdquo; to create department steps.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {caseData.schedule.map((step) => (
                    <div key={step.id} className="px-4 py-3">
                      {/* Department name + status icon */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`flex items-center gap-1 text-xs font-medium ${STEP_STATUS_STYLES[step.status]?.split(" ")[1] ?? "text-gray-400"}`}>
                          {STEP_ICONS[step.status]}
                        </span>
                        <span className="text-sm font-semibold text-white">{step.department}</span>
                        <div className="ml-auto">
                          <select
                            value={step.status}
                            onChange={(e) => updateStep(step.id, "status", e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border font-medium bg-transparent cursor-pointer focus:outline-none transition-all ${STEP_STATUS_STYLES[step.status]}`}
                          >
                            {STEP_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s} className="bg-gray-800 text-white">{s.replace("_", " ")}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Technician + dates */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-600 block mb-0.5">Technician</label>
                          <select
                            value={step.technicianId ?? ""}
                            onChange={(e) => updateStep(step.id, "technicianId", e.target.value || "")}
                            className="w-full text-xs px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-sky-500"
                          >
                            <option value="">Unassigned</option>
                            {technicians.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 block mb-0.5">Scheduled Date</label>
                          <input
                            type="date"
                            value={step.scheduledDate ? step.scheduledDate.slice(0, 10) : ""}
                            onChange={(e) => updateStep(step.id, "scheduledDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
                            className="w-full text-xs px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      {step.completedDate && (
                        <p className="text-[10px] text-green-500 mt-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed {formatDate(step.completedDate)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Audit Log ── */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700/50">
            <SectionHeader icon={Activity} title="Audit Log" />
          </div>
          {caseData.audits.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500 text-center">No audit entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/30">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/20">
                  {caseData.audits.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-700/10 transition-colors">
                      <td className="px-5 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString("en-US", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-300">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">
                        {entry.details ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {entry.authorName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
