import { NextRequest, NextResponse } from "next/server";
import { CaseRoute, CaseStatus, LogisticsStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { getSessionTenant } from "@/server/services/tenant";

const updateDispatchSchema = z
  .object({
    caseId: z.string().trim().min(1),
    route: z.enum(["LOCAL", "SHIP", "PICKUP"]).optional(),
    logisticsStatus: z
      .enum(["NOT_SCHEDULED", "PICKUP_REQUESTED", "SCHEDULED", "OUT_FOR_DELIVERY", "IN_TRANSIT", "DELIVERED"])
      .optional(),
    pickupDate: z.coerce.date().optional().nullable(),
    deliveryDate: z.coerce.date().optional().nullable(),
    shippingCarrier: z.string().trim().min(1).optional().nullable(),
    shippingTime: z.string().trim().min(1).optional().nullable(),
    shippingAddress: z.string().trim().min(1).optional().nullable(),
    courierName: z.string().trim().min(1).optional().nullable(),
    trackingNumber: z.string().trim().min(1).optional().nullable(),
    dispatchNotes: z.string().trim().min(1).optional().nullable(),
    _authorName: z.string().trim().min(1).optional(),
  })
  .strict();

const visibleLogisticsStatuses: LogisticsStatus[] = [
  "PICKUP_REQUESTED",
  "SCHEDULED",
  "OUT_FOR_DELIVERY",
  "IN_TRANSIT",
  "DELIVERED",
];

export async function GET(request: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const route = searchParams.get("route");
  const status = searchParams.get("status");
  const due = searchParams.get("due");

  const routeFilter =
    route && ["LOCAL", "SHIP", "PICKUP"].includes(route)
      ? (route as CaseRoute)
      : undefined;
  const logisticsStatusFilter =
    status && visibleLogisticsStatuses.includes(status as LogisticsStatus)
      ? (status as LogisticsStatus)
      : undefined;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const cases = await prisma.case.findMany({
    where: {
      tenantId: sessionTenant.tenantId,
      deletedAt: null,
      ...(routeFilter ? { route: routeFilter } : {}),
      ...(due === "today"
        ? {
            dueDate: {
              gte: startOfToday,
              lt: endOfToday,
            },
          }
        : {}),
      ...(logisticsStatusFilter
        ? { logisticsStatus: logisticsStatusFilter }
        : {
            OR: [
              { status: { in: [CaseStatus.COMPLETE, CaseStatus.SHIPPED] } },
              { logisticsStatus: { in: visibleLogisticsStatuses } },
              { route: { in: [CaseRoute.SHIP, CaseRoute.PICKUP] } },
            ],
          }),
    },
    include: {
      dentalAccount: true,
      technician: true,
      items: { where: { deletedAt: null } },
    },
    orderBy: [
      { logisticsStatus: "asc" },
      { deliveryDate: "asc" },
      { dueDate: "asc" },
      { receivedDate: "desc" },
    ],
  });

  return NextResponse.json(cases);
}

export async function PATCH(request: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateDispatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid dispatch payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { caseId, _authorName, logisticsStatus, ...updates } = parsed.data;
  const authorName = _authorName ?? await getSessionAuthorName();

  const existing = await prisma.case.findFirst({
    where: { id: caseId, tenantId: sessionTenant.tenantId, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const nextStatus =
    logisticsStatus === "DELIVERED" || logisticsStatus === "IN_TRANSIT"
      ? CaseStatus.SHIPPED
      : undefined;

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      ...updates,
      logisticsStatus,
      ...(nextStatus ? { status: nextStatus, shippedDate: existing.shippedDate ?? new Date() } : {}),
      audits: {
        create: {
          action: "DISPATCH_UPDATED",
          details: [
            logisticsStatus ? `Logistics: ${logisticsStatus}` : null,
            updates.route ? `Route: ${updates.route}` : null,
            updates.courierName ? `Courier: ${updates.courierName}` : null,
            updates.trackingNumber ? `Tracking: ${updates.trackingNumber}` : null,
          ]
            .filter(Boolean)
            .join("; "),
          authorName,
        },
      },
    },
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
    },
  });

  return NextResponse.json(updated);
}
