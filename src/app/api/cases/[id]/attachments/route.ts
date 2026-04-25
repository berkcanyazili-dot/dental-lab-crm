import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { inferAttachmentType } from "@/server/services/attachments";

const createAttachmentSchema = z
  .object({
    fileName: z.string().trim().min(1),
    fileUrl: z.string().trim().url(),
    fileType: z.enum(["stl", "pdf", "image", "other"]).optional(),
  })
  .strict();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const attachments = await prisma.attachment.findMany({
    where: { caseId: params.id },
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

  const existingCase = await prisma.case.findUnique({
    where: { id: params.id },
    select: { id: true, caseNumber: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const authorName = await getSessionAuthorName();
  const { fileName, fileUrl } = parsed.data;
  const fileType = parsed.data.fileType ?? inferAttachmentType(fileName);

  const attachment = await prisma.attachment.create({
    data: {
      caseId: params.id,
      fileName,
      fileUrl,
      fileType,
      uploadedBy: authorName,
    },
  });

  await prisma.caseAudit.create({
    data: {
      caseId: params.id,
      action: "ATTACHMENT_ADDED",
      details: `${fileName} (${fileType})`,
      authorName,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
