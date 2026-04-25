import { AccountingExportType, Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function dateWhere(field: "invoiceDate" | "dateApplied", range: DateRange) {
  const where: Record<string, unknown> = {};
  if (range.startDate || range.endDate) {
    where[field] = {
      ...(range.startDate ? { gte: range.startDate } : {}),
      ...(range.endDate ? { lte: range.endDate } : {}),
    };
  }
  return where;
}

export async function allocateInvoiceNumber(tx: TransactionClient) {
  const existingInvoiceCount = await tx.invoice.count();
  const sequence = await tx.numberSequence.upsert({
    where: { name: "INVOICE" },
    update: { value: { increment: 1 } },
    create: { name: "INVOICE", value: existingInvoiceCount + 1 },
  });

  return `INV-${String(sequence.value).padStart(6, "0")}`;
}

export async function buildInvoiceExport(range: DateRange) {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { not: "VOID" },
      ...dateWhere("invoiceDate", range),
    },
    include: {
      dentalAccount: true,
      case: { select: { caseNumber: true, patientName: true } },
    },
    orderBy: { invoiceDate: "asc" },
  });

  const headers = [
    "InvoiceNumber",
    "InvoiceDate",
    "Customer",
    "Doctor",
    "CaseNumber",
    "Patient",
    "Type",
    "SubTotal",
    "TaxTotal",
    "DiscountTotal",
    "RemakeTotal",
    "InvoiceTotal",
    "Balance",
    "Status",
    "Notes",
  ];

  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    dateOnly(invoice.invoiceDate),
    invoice.dentalAccount.name,
    invoice.dentalAccount.doctorName,
    invoice.case.caseNumber,
    invoice.case.patientName,
    invoice.type,
    invoice.subTotal,
    invoice.taxTotal,
    invoice.discountTotal,
    invoice.remakeTotal,
    invoice.invoiceTotal,
    invoice.balance,
    invoice.status,
    invoice.notes,
  ]);

  const totalAmount = invoices.reduce(
    (sum, invoice) => sum.plus(invoice.invoiceTotal),
    new Prisma.Decimal(0)
  );

  return {
    csv: csv(headers, rows),
    rowCount: rows.length,
    totalAmount,
  };
}

export async function buildPaymentExport(range: DateRange) {
  const payments = await prisma.payment.findMany({
    where: dateWhere("dateApplied", range),
    include: {
      invoice: {
        include: {
          dentalAccount: true,
          case: { select: { caseNumber: true, patientName: true } },
        },
      },
    },
    orderBy: { dateApplied: "asc" },
  });

  const headers = [
    "PaymentId",
    "DateApplied",
    "Customer",
    "InvoiceNumber",
    "CaseNumber",
    "Patient",
    "Amount",
    "PaymentType",
    "CheckNumber",
    "ReferenceId",
    "AccountNumber",
    "Notes",
  ];

  const rows = payments.map((payment) => [
    payment.id,
    dateOnly(payment.dateApplied),
    payment.invoice.dentalAccount.name,
    payment.invoice.invoiceNumber,
    payment.invoice.case.caseNumber,
    payment.invoice.case.patientName,
    payment.amount,
    payment.paymentType,
    payment.checkNumber,
    payment.referenceId,
    payment.accountNumber,
    payment.notes,
  ]);

  const totalAmount = payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0)
  );

  return {
    csv: csv(headers, rows),
    rowCount: rows.length,
    totalAmount,
  };
}

export async function buildCustomerExport() {
  const accounts = await prisma.dentalAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const headers = [
    "CustomerName",
    "Doctor",
    "Email",
    "Phone",
    "Fax",
    "Address",
    "City",
    "State",
    "Zip",
    "Notes",
  ];

  const rows = accounts.map((account) => [
    account.name,
    account.doctorName,
    account.email,
    account.phone,
    account.fax,
    account.address,
    account.city,
    account.state,
    account.zip,
    account.notes,
  ]);

  return {
    csv: csv(headers, rows),
    rowCount: rows.length,
    totalAmount: new Prisma.Decimal(0),
  };
}

export async function recordAccountingExport(input: {
  type: AccountingExportType;
  startDate?: Date;
  endDate?: Date;
  fileName: string;
  rowCount: number;
  totalAmount: Prisma.Decimal;
}) {
  return prisma.accountingExport.create({
    data: input,
  });
}
