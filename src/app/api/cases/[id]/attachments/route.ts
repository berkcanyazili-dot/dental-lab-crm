import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { inferAttachmentType } from "@/server/services/attachments";
import { reportTenantStorageUsageToStripe } from "@/server/services/storageBilling";

const createAttachmentSchema = z
  .object({
    fileName: z.string().trim().min(1),
    fileUrl: z.string().trim().url(),
    fileType: z.enum(["stl", "pdf", "image", "other"]).optional(),
    byteSize: z.number().int().min(0).optional(),
  })
  .strict();

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const existingCase = await prisma.case.findFirst({
    where: { ...buildCaseLookupWhere(params.id), deletedAt: null },
    select: { id: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const attachments = await prisma.attachment.findMany({
    where: { caseId: existingCase.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(attachments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = createAttachmentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid attachment payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existingCase = await prisma.case.findFirst({
    where: { ...buildCaseLookupWhere(params.id), deletedAt: null },
    select: { id: true, caseNumber: true, tenantId: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const authorName = await getSessionAuthorName();
  const { fileName, fileUrl, byteSize } = parsed.data;
  const fileType = parsed.data.fileType ?? inferAttachmentType(fileName);

  const attachment = await prisma.attachment.create({
    data: {
      caseId: existingCase.id,
      fileName,
      fileUrl,
      fileType,
      byteSize: byteSize ?? null,
      uploadedBy: authorName,
    },
  });

  await prisma.caseAudit.create({
    data: {
      caseId: existingCase.id,
      action: "ATTACHMENT_ADDED",
      details: `${fileName} (${fileType})`,
      authorName,
    },
  });

  if (existingCase.tenantId) {
    try {
      await reportTenantStorageUsageToStripe(existingCase.tenantId, {
        reason: "attachment_create",
        sourceKey: attachment.id,
      });
    } catch (error) {
      console.error("Failed to report tenant storage usage for manual attachment", error);
    }
  }

  return NextResponse.json(attachment, { status: 201 });
}
