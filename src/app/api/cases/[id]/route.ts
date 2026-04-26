import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fulfillShopifyOrder, isConfigured } from "@/lib/shopify";

const updateCaseSchema = z
  .object({
    patientName: z.string().trim().min(1).optional(),
    patientFirst: z.string().trim().min(1).optional().nullable(),
    patientMI: z.string().trim().min(1).optional().nullable(),
    patientLast: z.string().trim().min(1).optional().nullable(),
    patientAge: z.coerce.number().int().positive().optional().nullable(),
    patientGender: z.string().trim().min(1).optional().nullable(),
    dentalAccountId: z.string().trim().min(1).optional(),
    technicianId: z.string().trim().min(1).optional().nullable(),
    status: z.enum(["INCOMING", "IN_LAB", "WIP", "HOLD", "REMAKE", "COMPLETE", "SHIPPED"]).optional(),
    priority: z.enum(["NORMAL", "RUSH", "STAT"]).optional(),
    caseType: z.enum(["NEW", "REMAKE", "REPAIR"]).optional(),
    caseOrigin: z.enum(["LOCAL", "SHOPIFY"]).optional(),
    route: z.enum(["LOCAL", "SHIP", "PICKUP"]).optional(),
    rushOrder: z.coerce.boolean().optional(),
    tryIn: z.coerce.boolean().optional(),
    tryInLeadDays: z.coerce.number().int().nonnegative().optional().nullable(),
    caseGuarantee: z.coerce.boolean().optional(),
    receivedDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional().nullable(),
    shippedDate: z.coerce.date().optional().nullable(),
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
    logisticsStatus: z.enum(["NOT_SCHEDULED", "PICKUP_REQUESTED", "SCHEDULED", "OUT_FOR_DELIVERY", "IN_TRANSIT", "DELIVERED"]).optional(),
    pickupDate: z.coerce.date().optional().nullable(),
    deliveryDate: z.coerce.date().optional().nullable(),
    courierName: z.string().trim().min(1).optional().nullable(),
    trackingNumber: z.string().trim().min(1).optional().nullable(),
    dispatchNotes: z.string().trim().min(1).optional().nullable(),
    _authorName: z.string().trim().min(1).optional(),
  })
  .strict();

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: "Invalid case payload", issues: error.flatten() },
    { status: 400 }
  );
}

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
  const c = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id),
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
      fdaLots: {
        include: {
          caseItem: {
            select: {
              id: true,
              productType: true,
              toothNumbers: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      caseNotes: { orderBy: { createdAt: "desc" } },
      schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await request.json();
  const parsed = updateCaseSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  const { _authorName, ...body } = parsed.data;
  const authorName = _authorName ?? "Staff";

  const existingCase = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id),
    select: { id: true },
  });
  if (!existingCase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const before = await prisma.case.findUnique({ where: { id: existingCase.id } });
  const updated = await prisma.case.update({
    where: { id: existingCase.id },
    data: body as Prisma.CaseUncheckedUpdateInput,
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
      fdaLots: {
        include: {
          caseItem: {
            select: {
              id: true,
              productType: true,
              toothNumbers: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      caseNotes: { orderBy: { createdAt: "desc" } },
      schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  const changedFields = Object.keys(body)
    .filter((k) => {
      const updates = body as Record<string, unknown>;
      return updates[k] !== (before as Record<string, unknown>)?.[k];
    })
    .join(", ");

  if (changedFields) {
    await prisma.caseAudit.create({
      data: {
        caseId: existingCase.id,
        action: "CASE_UPDATED",
        details: changedFields,
        authorName,
      },
    });
  }

  // Auto-fulfill linked Shopify order when case is marked SHIPPED
  if (body.status === "SHIPPED" && before?.status !== "SHIPPED" && isConfigured()) {
    try {
      const shopifyOrder = await prisma.shopifyOrder.findUnique({
        where: { caseId: existingCase.id },
      });
      if (shopifyOrder) {
        await fulfillShopifyOrder(
          shopifyOrder.shopifyOrderId,
          updated.shippingCarrier,
          undefined
        );
        await prisma.caseAudit.create({
          data: {
            caseId: existingCase.id,
            action: "SHOPIFY_FULFILLED",
            details: `Shopify order #${shopifyOrder.shopifyOrderNumber} marked fulfilled`,
            authorName,
          },
        });
      }
    } catch (e) {
      // Log but don't fail the case update if Shopify fulfillment errors
      console.error("Shopify fulfillment error:", e);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const existingCase = await prisma.case.findFirst({
    where: buildCaseLookupWhere(params.id),
    select: { id: true },
  });
  if (!existingCase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.case.delete({ where: { id: existingCase.id } });
  return NextResponse.json({ success: true });
}
