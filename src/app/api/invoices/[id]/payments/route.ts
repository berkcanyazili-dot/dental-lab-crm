import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionTenant } from "@/server/services/tenant";

const paymentSchema = z
  .object({
    amount: z.union([z.string(), z.number()]),
    checkNumber: z.string().trim().min(1).optional().nullable(),
    paymentType: z.enum(["CHECK", "CASH", "CREDIT_CARD", "ACH", "OTHER"]).default("CHECK"),
    notes: z.string().trim().min(1).optional().nullable(),
    referenceId: z.string().trim().min(1).optional().nullable(),
    accountNumber: z.string().trim().min(1).optional().nullable(),
    dateApplied: z.coerce.date().optional(),
  })
  .strict();

function parsePaymentAmount(amount: string | number) {
  const decimal = new Prisma.Decimal(amount);
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new Error("Payment amount must be greater than zero");
  }
  return decimal;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  const payments = await prisma.payment.findMany({
    where: { invoiceId: params.id },
    orderBy: { dateApplied: "asc" },
  });
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  const parsed = paymentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payment payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let paymentAmount: Prisma.Decimal;
  try {
    paymentAmount = parsePaymentAmount(parsed.data.amount);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  const { checkNumber, paymentType, notes, referenceId, accountNumber, dateApplied } = parsed.data;

  const payment = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: params.id, tenantId: sessionTenant.tenantId } });
    if (!invoice) return null;

    const createdPayment = await tx.payment.create({
      data: {
        tenantId: sessionTenant.tenantId,
        invoiceId: params.id,
        amount: paymentAmount,
        checkNumber: checkNumber || null,
        paymentType,
        notes: notes || null,
        referenceId: referenceId || null,
        accountNumber: accountNumber || null,
        dateApplied: dateApplied ?? new Date(),
      },
    });

    const paymentTotals = await tx.payment.aggregate({
      where: { invoiceId: params.id },
      _sum: { amount: true },
    });
    const totalPaid = paymentTotals._sum.amount ?? new Prisma.Decimal(0);
    const remainingBalance = invoice.invoiceTotal.minus(totalPaid);
    const newBalance = remainingBalance.isNegative()
      ? new Prisma.Decimal(0)
      : remainingBalance;
    const newStatus = newBalance.lte(0)
      ? "PAID"
      : totalPaid.gt(0)
        ? "PARTIAL"
        : "OPEN";

    await tx.invoice.update({
      where: { id: params.id },
      data: { balance: newBalance, status: newStatus },
    });

    return createdPayment;
  });

  if (!payment) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  return NextResponse.json(payment, { status: 201 });
}
