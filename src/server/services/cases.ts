import { DeptScheduleStatus, Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveWorkflowTemplates } from "@/server/services/labSettings";
import { calculateDueDate } from "@/lib/utils";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Build schedule step create-inputs for a case.
 *
 * Strategy:
 *  1. Look up the ordered product names in the ServiceProduct catalog.
 *  2. Collect the unique departments attached to those products.
 *  3. Keep only the active WorkflowStepTemplates whose department appears in that set.
 *  4. If no catalog match survives the filter, fall back to any legacy department labels
 *     stored in `item.notes`.
 *  5. If we still have no match, fall back to ALL active templates so the case always gets
 *     a usable schedule.
 */
async function buildScheduleSteps(
  tx: TransactionClient,
  items: CreateCaseItemInput[]
): Promise<Array<{ department: string; sortOrder: number; status: DeptScheduleStatus }>> {
  const allTemplates = await getActiveWorkflowTemplates(tx);
  const orderedProductTypes = Array.from(
    new Set(items.map((item) => item.productType.trim()).filter(Boolean))
  );

  const catalogProducts = orderedProductTypes.length
    ? await tx.serviceProduct.findMany({
        where: {
          isActive: true,
          name: { in: orderedProductTypes },
        },
        select: { name: true, department: true },
      })
    : [];

  const catalogDepartments = new Set(
    catalogProducts.map((product) => product.department.trim()).filter(Boolean)
  );

  // Legacy fallback for items created before the service catalog carried department metadata.
  const legacyDepartments = new Set(
    items.map((i) => i.notes?.trim()).filter(Boolean) as string[]
  );

  const matched =
    catalogDepartments.size > 0
      ? allTemplates.filter((template) => catalogDepartments.has(template.department))
      : legacyDepartments.size > 0
        ? allTemplates.filter((template) => legacyDepartments.has(template.department))
        : [];

  const templates = matched.length > 0 ? matched : allTemplates;

  return templates.map((step) => ({
    department: step.department,
    sortOrder: step.sortOrder,
    status: DeptScheduleStatus.SCHEDULED,
  }));
}

/**
 * Resolve the due date for a new case.
 *
 * If the caller already supplied a `dueDate`, honour it exactly.
 * Otherwise, read `defaultTurnaroundDays` from LabSettings and advance
 * `receivedDate` by that many *business* days (weekends skipped).
 */
async function resolveDueDate(
  tx: TransactionClient,
  receivedDate: Date,
  suppliedDueDate: Date | null | undefined
): Promise<Date> {
  if (suppliedDueDate != null) return suppliedDueDate;

  const settings = await tx.labSettings.findUnique({ where: { id: "default" } });
  const turnaroundDays = settings?.defaultTurnaroundDays ?? 7;
  return calculateDueDate(receivedDate, turnaroundDays);
}

export interface CreateCaseItemInput {
  productType: string;
  toothNumbers?: string | null;
  units: number;
  shade?: string | null;
  material?: string | null;
  notes?: string | null;
  price: number | string | Prisma.Decimal;
}

export interface CreateCaseInput {
  patientName: string;
  patientFirst?: string | null;
  patientMI?: string | null;
  patientLast?: string | null;
  patientAge?: number | null;
  patientGender?: string | null;
  dentalAccountId: string;
  technicianId?: string | null;
  status?: Prisma.CaseUncheckedCreateInput["status"];
  priority?: Prisma.CaseUncheckedCreateInput["priority"];
  caseType?: Prisma.CaseUncheckedCreateInput["caseType"];
  caseOrigin?: Prisma.CaseUncheckedCreateInput["caseOrigin"];
  route?: Prisma.CaseUncheckedCreateInput["route"];
  rushOrder?: boolean;
  tryIn?: boolean;
  tryInLeadDays?: number | null;
  caseGuarantee?: boolean;
  receivedDate?: Date;
  dueDate?: Date | null;
  shippedDate?: Date | null;
  pan?: string | null;
  shade?: string | null;
  softTissueShade?: string | null;
  metalSelection?: string | null;
  selectedTeeth?: string | null;
  missingTeeth?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  materialsReceived?: string | null;
  shippingAddress?: string | null;
  shippingCarrier?: string | null;
  shippingTime?: string | null;
  logisticsStatus?: Prisma.CaseUncheckedCreateInput["logisticsStatus"];
  pickupDate?: Date | null;
  deliveryDate?: Date | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  dispatchNotes?: string | null;
  items?: CreateCaseItemInput[];
  generateSchedule?: boolean;
  auditAuthorName?: string;
  auditDetails?: string;
}

function decimal(value: number | string | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function calculateTotalValue(items: CreateCaseItemInput[]) {
  return items.reduce(
    (sum, item) => sum.plus(decimal(item.price).mul(item.units)),
    new Prisma.Decimal(0)
  );
}

async function allocateCaseNumber(tx: TransactionClient) {
  const existingCaseCount = await tx.case.count();
  const sequence = await tx.numberSequence.upsert({
    where: { name: "CASE" },
    update: { value: { increment: 1 } },
    create: { name: "CASE", value: existingCaseCount + 1 },
  });

  return `DL-${String(sequence.value).padStart(5, "0")}`;
}

export async function createCaseWithTx(
  tx: TransactionClient,
  input: CreateCaseInput,
  include?: Prisma.CaseInclude
) {
  const items = input.items ?? [];
  const caseNumber = await allocateCaseNumber(tx);
  const totalValue = calculateTotalValue(items);
  const auditDetails = input.auditDetails ?? `Case ${caseNumber} created`;

  // Resolve the receivedDate (default to now) and auto-compute dueDate if not supplied
  const receivedDate = input.receivedDate ?? new Date();
  const dueDate = await resolveDueDate(tx, receivedDate, input.dueDate);

  // Build the per-product schedule only when requested
  const scheduleSteps = input.generateSchedule
    ? await buildScheduleSteps(tx, items)
    : [];

  return tx.case.create({
    data: {
      caseNumber,
      patientName: input.patientName,
      patientFirst: input.patientFirst,
      patientMI: input.patientMI,
      patientLast: input.patientLast,
      patientAge: input.patientAge,
      patientGender: input.patientGender,
      dentalAccountId: input.dentalAccountId,
      technicianId: input.technicianId,
      status: input.status,
      priority: input.priority,
      caseType: input.caseType,
      caseOrigin: input.caseOrigin,
      route: input.route,
      rushOrder: input.rushOrder,
      tryIn: input.tryIn,
      tryInLeadDays: input.tryInLeadDays,
      caseGuarantee: input.caseGuarantee,
      receivedDate,
      dueDate,
      shippedDate: input.shippedDate,
      pan: input.pan,
      shade: input.shade,
      softTissueShade: input.softTissueShade,
      metalSelection: input.metalSelection,
      selectedTeeth: input.selectedTeeth,
      missingTeeth: input.missingTeeth,
      notes: input.notes,
      internalNotes: input.internalNotes,
      materialsReceived: input.materialsReceived,
      shippingAddress: input.shippingAddress,
      shippingCarrier: input.shippingCarrier,
      shippingTime: input.shippingTime,
      logisticsStatus: input.logisticsStatus,
      pickupDate: input.pickupDate,
      deliveryDate: input.deliveryDate,
      courierName: input.courierName,
      trackingNumber: input.trackingNumber,
      dispatchNotes: input.dispatchNotes,
      totalValue,
      items: { create: items },
      audits: {
        create: [
          {
            action: "CASE_CREATED",
            details: auditDetails,
            authorName: input.auditAuthorName ?? "Staff",
          },
        ],
      },
      ...(scheduleSteps.length > 0
        ? { schedule: { create: scheduleSteps } }
        : {}),
    },
    include,
  });
}

export async function createCase(input: CreateCaseInput, include?: Prisma.CaseInclude) {
  return prisma.$transaction((tx) => createCaseWithTx(tx, input, include));
}
