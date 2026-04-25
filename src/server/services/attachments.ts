export type AttachmentFileType = "stl" | "pdf" | "image" | "other";

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "application/octet-stream",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "model/stl",
] as const;

export function inferAttachmentType(fileName?: string | null, mimeType?: string | null): AttachmentFileType {
  const normalizedName = (fileName ?? "").toLowerCase();
  const normalizedMime = (mimeType ?? "").toLowerCase();

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

export function sanitizeAttachmentFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "attachment";
}
