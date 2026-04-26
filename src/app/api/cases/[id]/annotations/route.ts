import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { getSessionTenant } from "@/server/services/tenant";

const createAnnotationSchema = z
  .object({
    attachmentId: z.string().trim().min(1),
    x: z.coerce.number().finite(),
    y: z.coerce.number().finite(),
    z: z.coerce.number().finite(),
    content: z.string().trim().min(1),
    color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/).optional(),
    label: z.string().trim().max(80).optional().nullable(),
    visibleToDoctor: z.coerce.boolean().optional(),
  })
  .strict();

function buildCaseLookupWhere(rawId: string, tenantId: string): Prisma.CaseWhereInput {
  const normalized = rawId.trim();

  return {
    tenantId,
    deletedAt: null,
    OR: [
      { id: normalized },
      { caseNumber: normalized },
      { caseNumber: normalized.toUpperCase() },
    ],
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  const parsed = createAnnotationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid annotation payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existingCase = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id, sessionTenant.tenantId),
    select: { id: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const attachment = await prisma.attachment.findFirst({
    where: {
      id: parsed.data.attachmentId,
      caseId: existingCase.id,
      deletedAt: null,
    },
    select: {
      id: true,
      fileName: true,
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found for this case" }, { status: 404 });
  }

  const authorName = await getSessionAuthorName();

  const annotation = await prisma.$transaction(async (tx) => {
    const note = await tx.caseNote.create({
      data: {
        caseId: existingCase.id,
        content: parsed.data.content,
        authorName,
        visibleToDoctor: parsed.data.visibleToDoctor ?? false,
      },
    });

    const created = await tx.caseModelAnnotation.create({
      data: {
        caseId: existingCase.id,
        attachmentId: attachment.id,
        caseNoteId: note.id,
        x: parsed.data.x,
        y: parsed.data.y,
        z: parsed.data.z,
        color: parsed.data.color ?? "#f59e0b",
        label: parsed.data.label ?? null,
        authorName,
      },
      include: {
        caseNote: {
          select: {
            id: true,
            content: true,
            authorName: true,
            visibleToDoctor: true,
            createdAt: true,
          },
        },
        attachment: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
          },
        },
      },
    });

    await tx.caseAudit.create({
      data: {
        caseId: existingCase.id,
        action: "MODEL_ANNOTATION_ADDED",
        details: `${attachment.fileName}${parsed.data.label ? ` - ${parsed.data.label}` : ""}`,
        authorName,
      },
    });

    return created;
  });

  return NextResponse.json(annotation, { status: 201 });
}
