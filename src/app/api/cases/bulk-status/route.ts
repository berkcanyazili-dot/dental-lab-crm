import { NextRequest, NextResponse } from "next/server";
import { CaseStatus } from "@prisma/client";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { getSessionTenant } from "@/server/services/tenant";

const bulkStatusSchema = z
  .object({
    caseIds: z.array(z.string().trim().min(1)).min(1),
    status: z.nativeEnum(CaseStatus),
  })
  .strict();

export async function PATCH(request: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid bulk status payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const prisma = getTenantPrisma(sessionTenant.tenantId);
  const authorName = await getSessionAuthorName();
  const { caseIds, status } = parsed.data;
  const uniqueCaseIds = Array.from(new Set(caseIds));

  const matchedCases = await prisma.case.findMany({
    where: {
      id: { in: uniqueCaseIds },
      deletedAt: null,
    },
    select: {
      id: true,
      caseNumber: true,
      status: true,
    },
  });

  if (matchedCases.length === 0) {
    return NextResponse.json({ error: "No matching cases found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.case.updateMany({
      where: {
        id: { in: matchedCases.map((caseItem) => caseItem.id) },
      },
      data: { status },
    });

    await tx.caseAudit.createMany({
      data: matchedCases.map((caseItem) => ({
        caseId: caseItem.id,
        action: "BULK_STATUS_UPDATED",
        details: `${caseItem.status} -> ${status}`,
        authorName,
      })),
    });
  });

  return NextResponse.json({
    updatedCount: matchedCases.length,
    status,
  });
}
