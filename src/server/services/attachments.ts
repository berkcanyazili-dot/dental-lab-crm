export type AttachmentFileType = "stl" | "pdf" | "image" | "other";

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
