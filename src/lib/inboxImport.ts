import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface ImportedInboxAttachment {
  file: File;
  fileType: "stl" | "pdf" | "image" | "other";
}

export interface ImportedInboxData {
  sourceLabel: string;
  patientFirst: string;
  patientLast: string;
  patientName: string;
  toothNumbers: number[];
  attachments: ImportedInboxAttachment[];
  metadataSummary: string[];
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".heic"];
const XML_LIKE_EXTENSIONS = [".xml", ".dme", ".3oxz", ".3ox"];
const JSON_LIKE_EXTENSIONS = [".json"];
const TEXT_LIKE_EXTENSIONS = [".txt", ".csv", ".ini"];
const BINARY_ATTACHMENT_EXTENSIONS = [".stl", ".pdf", ...IMAGE_EXTENSIONS];
const KEY_PATTERNS = {
  first: ["patientfirstname", "firstname", "first", "givenname", "patientfirst"],
  last: ["patientlastname", "lastname", "last", "surname", "familyname", "patientlast"],
  full: ["patientname", "fullname", "patientfullname", "name"],
  tooth: ["tooth", "toothnumber", "toothnumbers", "teeth", "site", "unit"],
};

function normalizeKey(input: string) {
  return input.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function inferAttachmentType(name: string): ImportedInboxAttachment["fileType"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".stl")) return "stl";
  if (lower.endsWith(".pdf")) return "pdf";
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "image";
  return "other";
}

function splitPatientName(name: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return { first: "", last: "" };
  const parts = cleaned.split(" ");
  return {
    first: parts[0] ?? "",
    last: parts.slice(1).join(" ") || "",
  };
}

function collectStrings(value: unknown, bucket: string[] = []): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) bucket.push(trimmed);
    return bucket;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket));
    return bucket;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, bucket));
  }

  return bucket;
}

function maybeAssignPatientField(
  key: string,
  value: unknown,
  patient: { first: string; last: string; full: string }
) {
  const normalizedKey = normalizeKey(key);
  const strings = collectStrings(value);
  const primary = strings[0] ?? "";

  if (!patient.first && KEY_PATTERNS.first.some((pattern) => normalizedKey.includes(pattern))) {
    patient.first = primary;
  }

  if (!patient.last && KEY_PATTERNS.last.some((pattern) => normalizedKey.includes(pattern))) {
    patient.last = primary;
  }

  if (!patient.full && KEY_PATTERNS.full.some((pattern) => normalizedKey.includes(pattern))) {
    patient.full = primary;
  }
}

function collectMetadata(
  input: unknown,
  patient: { first: string; last: string; full: string },
  teeth: Set<number>
) {
  if (Array.isArray(input)) {
    input.forEach((item) => collectMetadata(item, patient, teeth));
    return;
  }

  if (!input || typeof input !== "object") return;

  for (const [key, value] of Object.entries(input)) {
    maybeAssignPatientField(key, value, patient);

    const normalizedKey = normalizeKey(key);
    if (KEY_PATTERNS.tooth.some((pattern) => normalizedKey.includes(pattern))) {
      collectStrings(value).forEach((candidate) => {
        candidate.match(/\b([1-9]|[12][0-9]|3[0-2])\b/g)?.forEach((match) => {
          teeth.add(Number(match));
        });
      });
    }

    collectMetadata(value, patient, teeth);
  }
}

function fallbackPatientAndTeethFromText(
  text: string,
  patient: { first: string; last: string; full: string },
  teeth: Set<number>
) {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const normalized = normalizeKey(trimmed);

    if (!patient.full && normalized.includes("patient")) {
      const fullMatch = trimmed.match(/patient[^a-z0-9]*[:=-]?\s*(.+)$/i);
      if (fullMatch?.[1]) {
        patient.full = fullMatch[1].trim();
      }
    }

    if (!patient.first) {
      const firstMatch = trimmed.match(/first\s*name[^a-z0-9]*[:=-]?\s*(.+)$/i);
      if (firstMatch?.[1]) patient.first = firstMatch[1].trim();
    }

    if (!patient.last) {
      const lastMatch = trimmed.match(/last\s*name[^a-z0-9]*[:=-]?\s*(.+)$/i);
      if (lastMatch?.[1]) patient.last = lastMatch[1].trim();
    }

    if (/tooth|teeth|site/i.test(trimmed)) {
      trimmed.match(/\b([1-9]|[12][0-9]|3[0-2])\b/g)?.forEach((match) => {
        teeth.add(Number(match));
      });
    }
  }
}

function extensionOf(path: string) {
  const lower = path.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  return dotIndex >= 0 ? lower.slice(dotIndex) : "";
}

export async function parseLabInboxArchive(file: File): Promise<ImportedInboxData> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: true,
    parseTagValue: true,
    trimValues: true,
  });

  const patient = { first: "", last: "", full: "" };
  const toothNumbers = new Set<number>();
  const attachments: ImportedInboxAttachment[] = [];
  const metadataSummary = new Set<string>();

  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const extension = extensionOf(entryPath);
    const filename = entryPath.split("/").pop() ?? entryPath;

    if (BINARY_ATTACHMENT_EXTENSIONS.includes(extension)) {
      const blob = await entry.async("blob");
      attachments.push({
        file: new File([blob], filename, { type: blob.type || undefined }),
        fileType: inferAttachmentType(filename),
      });
      continue;
    }

    if (XML_LIKE_EXTENSIONS.includes(extension)) {
      try {
        const xmlText = await entry.async("text");
        const parsed = parser.parse(xmlText);
        collectMetadata(parsed, patient, toothNumbers);
        fallbackPatientAndTeethFromText(xmlText, patient, toothNumbers);
        metadataSummary.add(filename);
      } catch {
        // Ignore malformed vendor files and keep extracting other entries.
      }
      continue;
    }

    if (JSON_LIKE_EXTENSIONS.includes(extension)) {
      try {
        const jsonText = await entry.async("text");
        const parsed = JSON.parse(jsonText);
        collectMetadata(parsed, patient, toothNumbers);
        fallbackPatientAndTeethFromText(jsonText, patient, toothNumbers);
        metadataSummary.add(filename);
      } catch {
        // Ignore malformed JSON and keep extracting other entries.
      }
      continue;
    }

    if (TEXT_LIKE_EXTENSIONS.includes(extension)) {
      const text = await entry.async("text");
      fallbackPatientAndTeethFromText(text, patient, toothNumbers);
      metadataSummary.add(filename);
    }
  }

  if (!patient.first && !patient.last && patient.full) {
    const split = splitPatientName(patient.full);
    patient.first = split.first;
    patient.last = split.last;
  }

  const patientName = [patient.first, patient.last].filter(Boolean).join(" ").trim() || patient.full.trim();

  return {
    sourceLabel: file.name,
    patientFirst: patient.first.trim(),
    patientLast: patient.last.trim(),
    patientName,
    toothNumbers: Array.from(toothNumbers).sort((a, b) => a - b),
    attachments,
    metadataSummary: Array.from(metadataSummary).sort(),
  };
}
