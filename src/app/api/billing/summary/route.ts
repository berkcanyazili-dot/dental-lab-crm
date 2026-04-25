import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function money(value: unknown) {
  return Number(value);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const invoices = await prisma.invoice.findMany({
    where: { dentalAccountId: accountId, status: { not: "VOID" } },
    include: { payments: true },
  });

  const now = new Date();
  const msPerDay = 86400000;

  let periodInvoices = 0;
  let periodPayments = 0;
  let balance = 0;
  const aging = { current: 0, d30: 0, d60: 0, d90: 0, d120: 0, d150: 0 };

  for (const inv of invoices) {
    const invoiceTotal = money(inv.invoiceTotal);
    const invoiceBalance = money(inv.balance);
    periodInvoices += invoiceTotal;
    const paid = inv.payments.reduce((s, p) => s + money(p.amount), 0);
    periodPayments += paid;
    balance += invoiceBalance;

    if (invoiceBalance > 0) {
      const ageDays = Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / msPerDay);
      if (ageDays <= 30) aging.current += invoiceBalance;
      else if (ageDays <= 60) aging.d30 += invoiceBalance;
      else if (ageDays <= 90) aging.d60 += invoiceBalance;
      else if (ageDays <= 120) aging.d90 += invoiceBalance;
      else if (ageDays <= 150) aging.d120 += invoiceBalance;
      else aging.d150 += invoiceBalance;
    }
  }

  return NextResponse.json({ periodInvoices, periodPayments, balance, aging });
}
