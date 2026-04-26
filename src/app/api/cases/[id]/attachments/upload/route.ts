import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { reportTenantStorageUsageToStripe } from "@/server/services/storageBilling";
import {
  ALLOWED_ATTACHMENT_CONTENT_TYPES,
  inferAttachmentType,
  sanitizeAttachmentFileName,
  type AttachmentFileType,
} from "@/server/services/attachments";

const clientPayloadSchema = z.object({
  caseId: z.string().trim().min(1),
  originalName: z.string().trim().min(1),
  fileType: z.enum(["stl", "pdf", "image", "other"]).optional(),
});

const uploadTokenPayloadSchema = z.object({
  caseId: z.string().trim().min(1),
  caseNumber: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  fileType: z.enum(["stl", "pdf", "image", "other"]),
  authorName: z.string().trim().min(1),
});

function buildCaseLookupWhere(rawId: string): Prisma.CaseWhereInput {
  const normalized = rawId.trim();

  return {
    OR: [
      { id: normalized },
      { caseNumber: normalized },
      { caseNumber: normalized.toUpperCase() },
    ],
  };
}

function inferAllowedContentTypes(fileType: AttachmentFileType) {
  switch (fileType) {
    case "image":
      return ALLOWED_ATTACHMENT_CONTENT_TYPES.filter((type) => type.startsWith("image/"));
    case "pdf":
      return ["application/pdf"];
    case "stl":
      return ["application/octet-stream", "application/sla", "application/vnd.ms-pki.stl", "model/stl"];
    default:
      return [...ALLOWED_ATTACHMENT_CONTENT_TYPES];
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const existingCase = await prisma.case.findFirst({
          where: buildCaseLookupWhere(params.id),
          select: { id: true, caseNumber: true, tenantId: true },
        });

        if (!existingCase) {
          throw new Error("Case not found.");
        }

        const parsedClientPayload = clientPayloadSchema.safeParse(JSON.parse(clientPayload ?? "{}"));
        if (!parsedClientPayload.success) {
          throw new Error("Invalid attachment upload payload.");
        }

        if (parsedClientPayload.data.caseId !== existingCase.id) {
          throw new Error("Attachment upload case mismatch.");
        }

        const fileName = sanitizeAttachmentFileName(parsedClientPayload.data.originalName);
        const fileType =
          parsedClientPayload.data.fileType ?? inferAttachmentType(parsedClientPayload.data.originalName);
        const authorName = await getSessionAuthorName();

        return {
          allowedContentTypes: inferAllowedContentTypes(fileType),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            caseId: existingCase.id,
            caseNumber: existingCase.caseNumber,
            fileName,
            fileType,
            authorName,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsedTokenPayload = uploadTokenPayloadSchema.safeParse(JSON.parse(tokenPayload ?? "{}"));
        if (!parsedTokenPayload.success) {
          throw new Error("Invalid attachment upload token.");
        }

        const { caseId, fileName, fileType, authorName } = parsedTokenPayload.data;

        const caseRecord = await prisma.case.findUnique({
          where: { id: caseId },
          select: { tenantId: true },
        });

        const blobMetadata = await head(blob.url);

        const attachment = await prisma.attachment.create({
          data: {
            caseId,
            fileName,
            fileUrl: blob.url,
            fileType,
            byteSize: blobMetadata.size,
            uploadedBy: authorName,
          },
        });

        await prisma.caseAudit.create({
          data: {
            caseId,
            action: "ATTACHMENT_ADDED",
            details: `${fileName} (${fileType})`,
            authorName,
          },
        });

        if (caseRecord?.tenantId) {
          try {
            await reportTenantStorageUsageToStripe(caseRecord.tenantId, {
              reason: "attachment_upload",
              sourceKey: attachment.id,
            });
          } catch (error) {
            console.error("Failed to report tenant storage usage after upload", error);
          }
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attachment upload could not be initialized.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
