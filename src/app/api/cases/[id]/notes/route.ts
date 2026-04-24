import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const notes = await prisma.caseNote.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { content, authorName } = await req.json();
  const note = await prisma.caseNote.create({
    data: { caseId: params.id, content, authorName: authorName ?? "Staff" },
  });
  await prisma.caseAudit.create({
    data: { caseId: params.id, action: "NOTE_ADDED", details: content.slice(0, 80), authorName: authorName ?? "Staff" },
  });
  return NextResponse.json(note, { status: 201 });
}
