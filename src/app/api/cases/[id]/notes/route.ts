import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";

const noteSchema = z
  .object({
    content: z.string().trim().min(1),
  })
  .strict();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const notes = await prisma.caseNote.findMany({
    where: { caseId: params.id },
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
  const { content } = parsed.data;
  const note = await prisma.caseNote.create({
    data: { caseId: params.id, content, authorName },
  });
  await prisma.caseAudit.create({
    data: { caseId: params.id, action: "NOTE_ADDED", details: content.slice(0, 80), authorName },
  });
  return NextResponse.json(note, { status: 201 });
}
