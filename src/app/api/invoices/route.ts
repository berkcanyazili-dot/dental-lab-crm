import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
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
  const body = await req.json();
  const { caseId, dentalAccountId, ...rest } = body;

  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${String(count + 1).padStart(6, "0")}`;

  // Default netTotal = subTotal - discountTotal + remakeTotal
  const subTotal = rest.subTotal ?? 0;
  const taxTotal = rest.taxTotal ?? 0;
  const discountTotal = rest.discountTotal ?? 0;
  const remakeTotal = rest.remakeTotal ?? 0;
  const netTotal = rest.netTotal ?? subTotal - discountTotal + remakeTotal;
  const invoiceTotal = rest.invoiceTotal ?? netTotal + taxTotal;

  const invoice = await prisma.invoice.create({
    data: {
      caseId,
      dentalAccountId,
      invoiceNumber,
      subTotal,
      taxTotal,
      discountTotal,
      remakeTotal,
      netTotal,
      invoiceTotal,
      balance: invoiceTotal,
      type: rest.type ?? "STANDARD",
      invoiceDate: rest.invoiceDate ? new Date(rest.invoiceDate) : new Date(),
      notes: rest.notes ?? null,
      status: "OPEN",
    },
    include: {
      case: { select: { caseNumber: true, patientName: true } },
      payments: true,
    },
  });
  return NextResponse.json(invoice, { status: 201 });
}
