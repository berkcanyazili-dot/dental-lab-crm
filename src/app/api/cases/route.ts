import { NextRequest, NextResponse } from "next/server";
import { CaseStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createCase } from "@/server/services/cases";
import { getSessionAuthorName } from "@/server/services/authorship";

const caseItemSchema = z
  .object({
    productType: z.string().trim().min(1),
    toothNumbers: z.string().trim().min(1).optional().nullable(),
    units: z.coerce.number().int().positive().default(1),
    shade: z.string().trim().min(1).optional().nullable(),
    material: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().min(1).optional().nullable(),
    price: z.coerce.number().nonnegative().default(0),
  })
  .strict();

const createCaseSchema = z
  .object({
    patientName: z.string().trim().min(1),
    patientFirst: z.string().trim().min(1).optional().nullable(),
    patientMI: z.string().trim().min(1).optional().nullable(),
    patientLast: z.string().trim().min(1).optional().nullable(),
    patientAge: z.coerce.number().int().positive().optional().nullable(),
    patientGender: z.string().trim().min(1).optional().nullable(),
    dentalAccountId: z.string().trim().min(1),
    technicianId: z.string().trim().min(1).optional().nullable(),
    priority: z.enum(["NORMAL", "RUSH", "STAT"]).default("NORMAL"),
    caseType: z.enum(["NEW", "REMAKE", "REPAIR"]).default("NEW"),
    caseOrigin: z.enum(["LOCAL", "SHOPIFY"]).default("LOCAL"),
    route: z.enum(["LOCAL", "SHIP", "PICKUP"]).default("LOCAL"),
    rushOrder: z.coerce.boolean().default(false),
    tryIn: z.coerce.boolean().default(false),
    tryInLeadDays: z.coerce.number().int().nonnegative().optional().nullable(),
    caseGuarantee: z.coerce.boolean().default(false),
    receivedDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional().nullable(),
    pan: z.string().trim().min(1).optional().nullable(),
    shade: z.string().trim().min(1).optional().nullable(),
    softTissueShade: z.string().trim().min(1).optional().nullable(),
    metalSelection: z.string().trim().min(1).optional().nullable(),
    selectedTeeth: z.string().trim().min(1).optional().nullable(),
    missingTeeth: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().min(1).optional().nullable(),
    internalNotes: z.string().trim().min(1).optional().nullable(),
    materialsReceived: z.string().trim().min(1).optional().nullable(),
    shippingAddress: z.string().trim().min(1).optional().nullable(),
    shippingCarrier: z.string().trim().min(1).optional().nullable(),
    shippingTime: z.string().trim().min(1).optional().nullable(),
    items: z.array(caseItemSchema).default([]),
    generateSchedule: z.coerce.boolean().default(false),
  })
  .strict();

const CASE_STATUSES = Object.values(CaseStatus);

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: "Invalid case payload", issues: error.flatten() },
    { status: 400 }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const accountId = searchParams.get("accountId");
  const caseNumber = searchParams.get("caseNumber");
  const statuses = status
    ? status.split(",").filter((value): value is CaseStatus =>
        CASE_STATUSES.includes(value as CaseStatus)
      )
    : [];

  if (status && statuses.length === 0) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const cases = await prisma.case.findMany({
    where: {
      ...(status ? { status: statuses.length > 1 ? { in: statuses } : statuses[0] } : {}),
      ...(accountId ? { dentalAccountId: accountId } : {}),
      ...(caseNumber ? { caseNumber: { contains: caseNumber.toUpperCase() } } : {}),
    },
    include: { dentalAccount: true, technician: true, items: true, schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { receivedDate: "desc" },
  });
  return NextResponse.json(cases);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const {
    items,
    generateSchedule,
    patientName,
    patientFirst,
    patientMI,
    patientLast,
    patientAge,
    patientGender,
    dentalAccountId,
    technicianId,
    priority,
    caseType,
    caseOrigin,
    route,
    rushOrder,
    tryIn,
    tryInLeadDays,
    caseGuarantee,
    receivedDate,
    dueDate,
    pan,
    shade,
    softTissueShade,
    metalSelection,
    selectedTeeth,
    missingTeeth,
    notes,
    internalNotes,
    materialsReceived,
    shippingAddress,
    shippingCarrier,
    shippingTime,
  } = parsed.data;
  const authorName = await getSessionAuthorName();

  const newCase = await createCase(
    {
      patientName,
      patientFirst,
      patientMI,
      patientLast,
      patientAge,
      patientGender,
      dentalAccountId,
      technicianId,
      priority,
      caseType,
      caseOrigin,
      route,
      rushOrder,
      tryIn,
      tryInLeadDays,
      caseGuarantee,
      receivedDate,
      dueDate,
      pan,
      shade,
      softTissueShade,
      metalSelection,
      selectedTeeth,
      missingTeeth,
      notes,
      internalNotes,
      materialsReceived,
      shippingAddress,
      shippingCarrier,
      shippingTime,
      items,
      generateSchedule,
      auditAuthorName: authorName,
    },
    {
      dentalAccount: true,
      technician: true,
      items: true,
      schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } },
    }
  );

  return NextResponse.json(newCase, { status: 201 });
}
