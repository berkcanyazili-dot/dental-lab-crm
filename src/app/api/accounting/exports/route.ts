import { NextRequest, NextResponse } from "next/server";
import { AccountingExportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildCustomerExport,
  buildInvoiceExport,
  buildPaymentExport,
  recordAccountingExport,
} from "@/server/services/accounting";

const EXPORT_TYPES = ["INVOICES", "PAYMENTS", "CUSTOMERS"] as const;
type ExportType = typeof EXPORT_TYPES[number];

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function fileName(type: ExportType, startDate?: Date, endDate?: Date) {
  const range = [
    startDate?.toISOString().slice(0, 10) ?? "all",
    endDate?.toISOString().slice(0, 10) ?? "all",
  ].join("_");
  return `dental-lab-${type.toLowerCase()}-${range}.csv`;
}

async function buildExport(type: ExportType, startDate?: Date, endDate?: Date) {
  if (type === "INVOICES") return buildInvoiceExport({ startDate, endDate });
  if (type === "PAYMENTS") return buildPaymentExport({ startDate, endDate });
  return buildCustomerExport();
}

export async function GET() {
  const exports = await prisma.accountingExport.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return NextResponse.json(exports);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get("type")?.toUpperCase();
  const type = EXPORT_TYPES.includes(requestedType as ExportType)
    ? (requestedType as ExportType)
    : "INVOICES";
  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate"));

  const built = await buildExport(type, startDate, endDate);
  const name = fileName(type, startDate, endDate);
  await recordAccountingExport({
    type: type as AccountingExportType,
    startDate,
    endDate,
    fileName: name,
    rowCount: built.rowCount,
    totalAmount: built.totalAmount,
  });

  return new NextResponse(built.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Export-File-Name": name,
      "X-Export-Row-Count": String(built.rowCount),
    },
  });
}
