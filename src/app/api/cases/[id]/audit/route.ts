import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const audits = await prisma.caseAudit.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(audits);
}
