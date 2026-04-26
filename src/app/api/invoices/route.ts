import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { allocateInvoiceNumber } from "@/server/services/accounting";
import { getSessionTenant } from "@/server/services/tenant";

const createInvoiceSchema = z
  .object({
    caseId: z.string().trim().min(1),
    dentalAccountId: z.string().trim().min(1),
    subTotal: z.coerce.number().nonnegative().default(0),
    taxTotal: z.coerce.number().nonnegative().default(0),
    discountTotal: z.coerce.number().nonnegative().default(0),
    remakeTotal: z.coerce.number().nonnegative().default(0),
    netTotal: z.coerce.number().nonnegative().optional(),
    invoiceTotal: z.coerce.number().nonnegative().optional(),
    type: z.enum(["STANDARD", "CREDIT", "REMAKE"]).default("STANDARD"),
    invoiceDate: z.coerce.date().optional(),
    notes: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const year = searchParams.get("year");
  const month = searchParams.get("month"); // 0-based

  const where: Record<string, unknown> = {};
  if (accountId) where.dentalAccountId = accountId;
  if (year && month !== null) {
    const y = parseInt(year);
    const m = parseInt(month);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);
    where.invoiceDate = { gte: start, lt: end };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      case: { select: { caseNumber: true, patientName: true } },
      payments: { orderBy: { dateApplied: "asc" } },
    },
    orderBy: { invoiceDate: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  const parsed = createInvoiceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invoice payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const subTotal = new Prisma.Decimal(data.subTotal);
  const taxTotal = new Prisma.Decimal(data.taxTotal);
  const discountTotal = new Prisma.Decimal(data.discountTotal);
  const remakeTotal = new Prisma.Decimal(data.remakeTotal);
  const netTotal = data.netTotal !== undefined
    ? new Prisma.Decimal(data.netTotal)
    : subTotal.minus(discountTotal).plus(remakeTotal);
  const invoiceTotal = data.invoiceTotal !== undefined
    ? new Prisma.Decimal(data.invoiceTotal)
    : netTotal.plus(taxTotal);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await allocateInvoiceNumber(tx);
    return tx.invoice.create({
      data: {
        tenantId: sessionTenant.tenantId,
        caseId: data.caseId,
        dentalAccountId: data.dentalAccountId,
        invoiceNumber,
        subTotal,
        taxTotal,
        discountTotal,
        remakeTotal,
        netTotal,
        invoiceTotal,
        balance: invoiceTotal,
        type: data.type,
        invoiceDate: data.invoiceDate ?? new Date(),
        notes: data.notes ?? null,
        status: "OPEN",
      },
      include: {
        case: { select: { caseNumber: true, patientName: true } },
        payments: true,
      },
    });
  });

  return NextResponse.json(invoice, { status: 201 });
}
