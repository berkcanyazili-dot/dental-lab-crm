import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEPARTMENTS = ["Scan", "Design", "Milling", "C&B QC", "Stain & Glaze", "Final QC", "Shipping"];

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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
      receivedDate: input.receivedDate,
      dueDate: input.dueDate,
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
      ...(input.generateSchedule
        ? {
            schedule: {
              create: DEPARTMENTS.map((department, sortOrder) => ({
                department,
                sortOrder,
                status: "SCHEDULED",
              })),
            },
          }
        : {}),
    },
    include,
  });
}

export async function createCase(input: CreateCaseInput, include?: Prisma.CaseInclude) {
  return prisma.$transaction((tx) => createCaseWithTx(tx, input, include));
}
