import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const payments = await prisma.payment.findMany({
    where: { invoiceId: params.id },
    orderBy: { dateApplied: "asc" },
  });
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { amount, checkNumber, paymentType, notes, referenceId, accountNumber, dateApplied } = body;

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const payment = await prisma.payment.create({
    data: {
      invoiceId: params.id,
      amount: parseFloat(amount),
      checkNumber: checkNumber || null,
      paymentType: paymentType || "CHECK",
      notes: notes || null,
      referenceId: referenceId || null,
      accountNumber: accountNumber || null,
      dateApplied: dateApplied ? new Date(dateApplied) : new Date(),
    },
  });

  // Recalculate invoice balance
  const allPayments = await prisma.payment.findMany({ where: { invoiceId: params.id } });
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
  const newBalance = Math.max(0, invoice.invoiceTotal - totalPaid);
  const newStatus = newBalance <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "OPEN";

  await prisma.invoice.update({
    where: { id: params.id },
    data: { balance: newBalance, status: newStatus },
  });

  return NextResponse.json(payment, { status: 201 });
}
