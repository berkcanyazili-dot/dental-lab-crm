import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { notifyDoctorOfPublicNote } from "@/server/services/doctorNotifications";

const noteSchema = z
  .object({
    content: z.string().trim().min(1),
    visibleToDoctor: z.boolean().optional().default(false),
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
    where: buildCaseLookupWhere(params.id),
    select: { id: true },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const notes = await prisma.caseNote.findMany({
    where: { caseId: existingCase.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = noteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid note payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const authorName = await getSessionAuthorName();
  const { content, visibleToDoctor } = parsed.data;
  const existingCase = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id),
    select: {
      id: true,
      caseNumber: true,
      patientName: true,
      dentalAccount: {
        select: {
          name: true,
          doctorName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!existingCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const note = await prisma.caseNote.create({
    data: { caseId: existingCase.id, content, authorName, visibleToDoctor },
  });

  if (visibleToDoctor) {
    void notifyDoctorOfPublicNote({
      caseNumber: existingCase.caseNumber,
      patientName: existingCase.patientName,
      doctorName: existingCase.dentalAccount.doctorName,
      accountName: existingCase.dentalAccount.name,
      authorName,
      noteContent: content,
      toEmail: existingCase.dentalAccount.email ?? null,
      toPhone: existingCase.dentalAccount.phone ?? null,
    });
  }

  await prisma.caseAudit.create({
    data: {
      caseId: existingCase.id,
      action: "NOTE_ADDED",
      details: visibleToDoctor ? `Doctor-visible: ${content.slice(0, 80)}` : content.slice(0, 80),
      authorName,
    },
  });
  return NextResponse.json(note, { status: 201 });
}
