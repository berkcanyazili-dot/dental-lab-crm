import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { createCase } from "@/server/services/cases";
import { getDoctorSession } from "@/server/services/portal";

const portalItemSchema = z
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

const portalCreateCaseSchema = z
  .object({
    patientName: z.string().trim().min(1),
    patientFirst: z.string().trim().min(1).optional().nullable(),
    patientLast: z.string().trim().min(1).optional().nullable(),
    patientAge: z.coerce.number().int().positive().optional().nullable(),
    caseType: z.enum(["NEW", "REMAKE", "REPAIR"]).default("NEW"),
    priority: z.enum(["NORMAL", "RUSH", "STAT"]).default("NORMAL"),
    route: z.enum(["LOCAL", "SHIP", "PICKUP"]).default("LOCAL"),
    dueDate: z.coerce.date().optional().nullable(),
    pan: z.string().trim().min(1).optional().nullable(),
    shade: z.string().trim().min(1).optional().nullable(),
    selectedTeeth: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().min(1).optional().nullable(),
    materialsReceived: z.string().trim().min(1).optional().nullable(),
    shippingAddress: z.string().trim().min(1).optional().nullable(),
    items: z.array(portalItemSchema).min(1),
  })
  .strict();

export async function GET() {
  const doctor = await getDoctorSession();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(doctor.tenantId);

  const cases = await prisma.case.findMany({
    where: { dentalAccountId: doctor.dentalAccountId },
    select: {
      id: true,
      caseNumber: true,
      patientName: true,
      status: true,
      priority: true,
      caseType: true,
      pan: true,
      shade: true,
      receivedDate: true,
      dueDate: true,
      shippedDate: true,
      totalValue: true,
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          invoiceTotal: true,
          balance: true,
          status: true,
        },
        orderBy: { invoiceDate: "desc" },
      },
      items: {
        select: {
          id: true,
          productType: true,
          toothNumbers: true,
          units: true,
          shade: true,
        },
      },
      schedule: {
        select: {
          id: true,
          department: true,
          sortOrder: true,
          status: true,
          completedDate: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { receivedDate: "desc" },
  });

  return NextResponse.json(cases);
}

export async function POST(request: NextRequest) {
  const doctor = await getDoctorSession();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(doctor.tenantId);

  const body = await request.json();
  const parsed = portalCreateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid portal order", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const order = parsed.data;
  const account = await prisma.dentalAccount.findFirst({
    where: { id: doctor.dentalAccountId, deletedAt: null },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Doctor account not found" }, { status: 404 });
  }

  const newCase = await createCase(
    {
      tenantId: doctor.tenantId,
      patientName: order.patientName,
      patientFirst: order.patientFirst,
      patientLast: order.patientLast,
      patientAge: order.patientAge,
      dentalAccountId: doctor.dentalAccountId,
      priority: order.priority,
      caseType: order.caseType,
      caseOrigin: "LOCAL",
      route: order.route,
      rushOrder: order.priority !== "NORMAL",
      dueDate: order.dueDate,
      pan: order.pan,
      shade: order.shade,
      selectedTeeth: order.selectedTeeth,
      notes: order.notes,
      materialsReceived: order.materialsReceived,
      shippingAddress: order.shippingAddress,
      items: order.items,
      generateSchedule: true,
      auditAuthorName: doctor.name ?? doctor.email ?? "Doctor Portal",
      auditDetails: "Case submitted from doctor portal",
    },
    {
      items: true,
      schedule: { orderBy: { sortOrder: "asc" } },
    }
  );

  return NextResponse.json(newCase, { status: 201 });
}
