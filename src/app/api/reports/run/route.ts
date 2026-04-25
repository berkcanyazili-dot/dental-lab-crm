import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  type?: "currency" | "date" | "number" | "text";
}

export interface ReportResult {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number>;
}

function money(value: unknown) {
  return Number(value);
}
function fmt(n: unknown) { return money(n); }
function fmtDate(d: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

type DateRange = { from: Date; to: Date };

async function runReport(report: string, range: DateRange): Promise<ReportResult> {
  const { from, to } = range;
  const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999);

  switch (report) {

    case "daily-invoice-payment": {
      const invoices = await prisma.invoice.findMany({
        where: { invoiceDate: { gte: from, lte: toEnd } },
        include: {
          case: { select: { caseNumber: true, patientName: true } },
          dentalAccount: { select: { name: true, doctorName: true } },
          payments: true,
        },
        orderBy: { invoiceDate: "desc" },
      });
      const rows = invoices.map((inv) => {
        const paid = inv.payments.reduce((s, p) => s + money(p.amount), 0);
        return {
          date: fmtDate(inv.invoiceDate),
          invoice: inv.invoiceNumber,
          caseNumber: inv.case.caseNumber,
          doctor: inv.dentalAccount.doctorName ? `Dr. ${inv.dentalAccount.doctorName}` : inv.dentalAccount.name,
          patient: inv.case.patientName,
          total: fmt(inv.invoiceTotal),
          paid: fmt(paid),
          balance: fmt(inv.balance),
        };
      });
      return {
        title: "Daily Invoice & Payment Report",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "date", label: "Date" },
          { key: "invoice", label: "Invoice #" },
          { key: "caseNumber", label: "Case #" },
          { key: "doctor", label: "Doctor" },
          { key: "patient", label: "Patient" },
          { key: "total", label: "Invoice Total", align: "right", type: "currency" },
          { key: "paid", label: "Paid", align: "right", type: "currency" },
          { key: "balance", label: "Balance", align: "right", type: "currency" },
        ],
        rows,
        totals: {
          total: rows.reduce((s, r) => s + (r.total as number), 0),
          paid: rows.reduce((s, r) => s + (r.paid as number), 0),
          balance: rows.reduce((s, r) => s + (r.balance as number), 0),
        },
      };
    }

    case "daily-totals": {
      const cases = await prisma.case.findMany({
        where: { receivedDate: { gte: from, lte: toEnd } },
        select: { receivedDate: true, status: true, totalValue: true },
        orderBy: { receivedDate: "asc" },
      });
      const byDay: Record<string, { count: number; value: number; statuses: Record<string, number> }> = {};
      for (const c of cases) {
        const day = fmtDate(c.receivedDate) as string;
        if (!byDay[day]) byDay[day] = { count: 0, value: 0, statuses: {} };
        byDay[day].count++;
        byDay[day].value += money(c.totalValue);
        byDay[day].statuses[c.status] = (byDay[day].statuses[c.status] ?? 0) + 1;
      }
      const rows = Object.entries(byDay).map(([date, d]) => ({
        date,
        cases: d.count,
        incoming: d.statuses["INCOMING"] ?? 0,
        inLab: d.statuses["IN_LAB"] ?? 0,
        wip: d.statuses["WIP"] ?? 0,
        complete: d.statuses["COMPLETE"] ?? 0,
        shipped: d.statuses["SHIPPED"] ?? 0,
        value: fmt(d.value),
      }));
      return {
        title: "Daily Totals",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "date", label: "Date" },
          { key: "cases", label: "Total Cases", align: "right", type: "number" },
          { key: "incoming", label: "Incoming", align: "right", type: "number" },
          { key: "inLab", label: "In Lab", align: "right", type: "number" },
          { key: "wip", label: "WIP", align: "right", type: "number" },
          { key: "complete", label: "Complete", align: "right", type: "number" },
          { key: "shipped", label: "Shipped", align: "right", type: "number" },
          { key: "value", label: "Total Value", align: "right", type: "currency" },
        ],
        rows,
        totals: { cases: cases.length, value: cases.reduce((s, c) => s + money(c.totalValue), 0) },
      };
    }

    case "doctor-monthly-sales": {
      const invoices = await prisma.invoice.findMany({
        where: { invoiceDate: { gte: from, lte: toEnd } },
        include: { dentalAccount: { select: { name: true, doctorName: true } } },
        orderBy: [{ dentalAccountId: "asc" }, { invoiceDate: "asc" }],
      });
      const key = (inv: typeof invoices[0]) => {
        const m = new Date(inv.invoiceDate);
        return `${inv.dentalAccount.name}__${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      };
      const agg: Record<string, { doctor: string; account: string; month: string; count: number; total: number; paid: number; balance: number }> = {};
      for (const inv of invoices) {
        const k = key(inv);
        const m = new Date(inv.invoiceDate);
        if (!agg[k]) agg[k] = {
          doctor: inv.dentalAccount.doctorName ? `Dr. ${inv.dentalAccount.doctorName}` : inv.dentalAccount.name,
          account: inv.dentalAccount.name,
          month: m.toLocaleString("en-US", { month: "long", year: "numeric" }),
          count: 0, total: 0, paid: 0, balance: 0,
        };
        agg[k].count++;
        agg[k].total += money(inv.invoiceTotal);
        agg[k].balance += money(inv.balance);
      }
      const rows = Object.values(agg).map((r) => ({ ...r, total: fmt(r.total), balance: fmt(r.balance) }));
      return {
        title: "Doctor Monthly Sales",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "month", label: "Month" },
          { key: "doctor", label: "Doctor" },
          { key: "account", label: "Practice" },
          { key: "count", label: "Invoices", align: "right", type: "number" },
          { key: "total", label: "Total", align: "right", type: "currency" },
          { key: "balance", label: "Outstanding", align: "right", type: "currency" },
        ],
        rows,
        totals: { total: Object.values(agg).reduce((s, r) => s + r.total, 0), balance: Object.values(agg).reduce((s, r) => s + r.balance, 0) },
      };
    }

    case "doctors-without-cases": {
      const accounts = await prisma.dentalAccount.findMany({
        include: {
          cases: {
            where: { receivedDate: { gte: from, lte: toEnd } },
            select: { id: true },
          },
        },
        orderBy: { name: "asc" },
      });
      const rows = accounts
        .filter((a) => a.cases.length === 0)
        .map((a) => ({
          practice: a.name,
          doctor: a.doctorName ? `Dr. ${a.doctorName}` : "—",
          phone: a.phone ?? "—",
          email: a.email ?? "—",
          active: a.isActive ? "Yes" : "No",
        }));
      return {
        title: "Doctors Without Cases",
        subtitle: `No cases received ${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "practice", label: "Practice" },
          { key: "doctor", label: "Doctor" },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "active", label: "Active" },
        ],
        rows,
      };
    }

    case "invoice-register": {
      const invoices = await prisma.invoice.findMany({
        where: { invoiceDate: { gte: from, lte: toEnd } },
        include: {
          case: { select: { caseNumber: true, patientName: true } },
          dentalAccount: { select: { name: true, doctorName: true } },
        },
        orderBy: [{ dentalAccountId: "asc" }, { invoiceDate: "desc" }],
      });
      const rows = invoices.map((inv) => ({
        doctor: inv.dentalAccount.doctorName ? `Dr. ${inv.dentalAccount.doctorName}` : inv.dentalAccount.name,
        practice: inv.dentalAccount.name,
        invoice: inv.invoiceNumber,
        caseNumber: inv.case.caseNumber,
        patient: inv.case.patientName,
        date: fmtDate(inv.invoiceDate),
        type: inv.type,
        total: fmt(inv.invoiceTotal),
        balance: fmt(inv.balance),
        status: inv.status,
      }));
      return {
        title: "Invoice Register by Doctor",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "doctor", label: "Doctor" },
          { key: "practice", label: "Practice" },
          { key: "invoice", label: "Invoice #" },
          { key: "caseNumber", label: "Case #" },
          { key: "patient", label: "Patient" },
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "total", label: "Total", align: "right", type: "currency" },
          { key: "balance", label: "Balance", align: "right", type: "currency" },
          { key: "status", label: "Status" },
        ],
        rows,
        totals: {
          total: invoices.reduce((s, i) => s + money(i.invoiceTotal), 0),
          balance: invoices.reduce((s, i) => s + money(i.balance), 0),
        },
      };
    }

    case "outstanding-invoices": {
      const invoices = await prisma.invoice.findMany({
        where: { balance: { gt: 0 }, status: { not: "VOID" } },
        include: {
          case: { select: { caseNumber: true, patientName: true } },
          dentalAccount: { select: { name: true, doctorName: true } },
        },
        orderBy: { invoiceDate: "asc" },
      });
      const now = new Date();
      const rows = invoices.map((inv) => ({
        doctor: inv.dentalAccount.doctorName ? `Dr. ${inv.dentalAccount.doctorName}` : inv.dentalAccount.name,
        invoice: inv.invoiceNumber,
        caseNumber: inv.case.caseNumber,
        patient: inv.case.patientName,
        date: fmtDate(inv.invoiceDate),
        days: daysBetween(new Date(inv.invoiceDate), now),
        total: fmt(inv.invoiceTotal),
        balance: fmt(inv.balance),
        status: inv.status,
      }));
      return {
        title: "Outstanding Invoices",
        columns: [
          { key: "doctor", label: "Doctor" },
          { key: "invoice", label: "Invoice #" },
          { key: "caseNumber", label: "Case #" },
          { key: "patient", label: "Patient" },
          { key: "date", label: "Invoice Date" },
          { key: "days", label: "Days", align: "right", type: "number" },
          { key: "total", label: "Invoice Total", align: "right", type: "currency" },
          { key: "balance", label: "Balance", align: "right", type: "currency" },
          { key: "status", label: "Status" },
        ],
        rows,
        totals: {
          total: invoices.reduce((s, i) => s + money(i.invoiceTotal), 0),
          balance: invoices.reduce((s, i) => s + money(i.balance), 0),
        },
      };
    }

    case "payment-register": {
      const payments = await prisma.payment.findMany({
        where: { dateApplied: { gte: from, lte: toEnd } },
        include: {
          invoice: {
            include: {
              case: { select: { caseNumber: true } },
              dentalAccount: { select: { name: true, doctorName: true } },
            },
          },
        },
        orderBy: { dateApplied: "desc" },
      });
      const rows = payments.map((p) => ({
        date: fmtDate(p.dateApplied),
        doctor: p.invoice.dentalAccount.doctorName ? `Dr. ${p.invoice.dentalAccount.doctorName}` : p.invoice.dentalAccount.name,
        invoice: p.invoice.invoiceNumber,
        caseNumber: p.invoice.case.caseNumber,
        amount: fmt(p.amount),
        type: p.paymentType.replace("_", " "),
        checkNumber: p.checkNumber ?? "—",
        notes: p.notes ?? "—",
      }));
      return {
        title: "Payment Register",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "date", label: "Date" },
          { key: "doctor", label: "Doctor" },
          { key: "invoice", label: "Invoice #" },
          { key: "caseNumber", label: "Case #" },
          { key: "amount", label: "Amount", align: "right", type: "currency" },
          { key: "type", label: "Type" },
          { key: "checkNumber", label: "Check #" },
          { key: "notes", label: "Notes" },
        ],
        rows,
        totals: { amount: payments.reduce((s, p) => s + money(p.amount), 0) },
      };
    }

    case "product-sales": {
      const items = await prisma.caseItem.findMany({
        where: { case: { receivedDate: { gte: from, lte: toEnd }, caseType: { not: "REMAKE" } } },
        select: { productType: true, units: true, price: true },
      });
      const agg: Record<string, { units: number; revenue: number; orders: number }> = {};
      for (const item of items) {
        if (!agg[item.productType]) agg[item.productType] = { units: 0, revenue: 0, orders: 0 };
        agg[item.productType].units += item.units;
        agg[item.productType].revenue += money(item.price) * item.units;
        agg[item.productType].orders++;
      }
      const rows = Object.entries(agg)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([product, d]) => ({
          product,
          orders: d.orders,
          units: d.units,
          revenue: fmt(d.revenue),
          avgPrice: fmt(d.units > 0 ? d.revenue / d.units : 0),
        }));
      return {
        title: "Product Sales Analysis",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "product", label: "Product" },
          { key: "orders", label: "Orders", align: "right", type: "number" },
          { key: "units", label: "Units", align: "right", type: "number" },
          { key: "revenue", label: "Revenue", align: "right", type: "currency" },
          { key: "avgPrice", label: "Avg / Unit", align: "right", type: "currency" },
        ],
        rows,
        totals: {
          units: rows.reduce((s, r) => s + (r.units as number), 0),
          revenue: rows.reduce((s, r) => s + (r.revenue as number), 0),
        },
      };
    }

    case "product-sales-remakes": {
      const items = await prisma.caseItem.findMany({
        where: { case: { receivedDate: { gte: from, lte: toEnd } } },
        select: { productType: true, units: true, price: true, case: { select: { caseType: true } } },
      });
      const agg: Record<string, { saleUnits: number; saleRev: number; remakeUnits: number; remakeRev: number }> = {};
      for (const item of items) {
        if (!agg[item.productType]) agg[item.productType] = { saleUnits: 0, saleRev: 0, remakeUnits: 0, remakeRev: 0 };
        const isRemake = item.case.caseType === "REMAKE";
        if (isRemake) { agg[item.productType].remakeUnits += item.units; agg[item.productType].remakeRev += money(item.price) * item.units; }
        else { agg[item.productType].saleUnits += item.units; agg[item.productType].saleRev += money(item.price) * item.units; }
      }
      const rows = Object.entries(agg)
        .sort((a, b) => b[1].saleRev - a[1].saleRev)
        .map(([product, d]) => ({
          product,
          saleUnits: d.saleUnits,
          saleRevenue: fmt(d.saleRev),
          remakeUnits: d.remakeUnits,
          remakeRevenue: fmt(d.remakeRev),
          remakePct: d.saleUnits > 0 ? Math.round((d.remakeUnits / d.saleUnits) * 100) : 0,
        }));
      return {
        title: "Product Sales and Remakes",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "product", label: "Product" },
          { key: "saleUnits", label: "Sale Units", align: "right", type: "number" },
          { key: "saleRevenue", label: "Sale Revenue", align: "right", type: "currency" },
          { key: "remakeUnits", label: "Remake Units", align: "right", type: "number" },
          { key: "remakeRevenue", label: "Remake Revenue", align: "right", type: "currency" },
          { key: "remakePct", label: "Remake %", align: "right" },
        ],
        rows,
        totals: {
          saleUnits: rows.reduce((s, r) => s + (r.saleUnits as number), 0),
          saleRevenue: rows.reduce((s, r) => s + (r.saleRevenue as number), 0),
          remakeUnits: rows.reduce((s, r) => s + (r.remakeUnits as number), 0),
          remakeRevenue: rows.reduce((s, r) => s + (r.remakeRevenue as number), 0),
        },
      };
    }

    case "scheduled-cases-by-step": {
      const steps = await prisma.deptSchedule.findMany({
        include: {
          case: {
            select: {
              caseNumber: true, status: true, dueDate: true,
              dentalAccount: { select: { name: true, doctorName: true } },
              patientName: true,
            },
          },
          technician: { select: { name: true } },
        },
        orderBy: [{ department: "asc" }, { sortOrder: "asc" }],
      });
      const rows = steps.map((s) => ({
        department: s.department,
        status: s.status.replace("_", " "),
        caseNumber: s.case.caseNumber,
        patient: s.case.patientName,
        doctor: s.case.dentalAccount.doctorName ? `Dr. ${s.case.dentalAccount.doctorName}` : s.case.dentalAccount.name,
        technician: s.technician?.name ?? "—",
        scheduledDate: fmtDate(s.scheduledDate),
        completedDate: fmtDate(s.completedDate),
        dueDate: fmtDate(s.case.dueDate),
      }));
      return {
        title: "Scheduled Cases by Step",
        columns: [
          { key: "department", label: "Department" },
          { key: "status", label: "Status" },
          { key: "caseNumber", label: "Case #" },
          { key: "patient", label: "Patient" },
          { key: "doctor", label: "Doctor" },
          { key: "technician", label: "Technician" },
          { key: "scheduledDate", label: "Scheduled" },
          { key: "completedDate", label: "Completed" },
          { key: "dueDate", label: "Due" },
        ],
        rows,
      };
    }

    case "tech-productivity": {
      const cases = await prisma.case.findMany({
        where: { receivedDate: { gte: from, lte: toEnd } },
        include: {
          technician: { select: { name: true } },
          items: { select: { units: true } },
          schedule: { where: { status: "COMPLETE" }, select: { id: true } },
        },
      });
      const agg: Record<string, { name: string; caseCount: number; units: number; completedSteps: number; value: number }> = {};
      for (const c of cases) {
        const name = c.technician?.name ?? "Unassigned";
        if (!agg[name]) agg[name] = { name, caseCount: 0, units: 0, completedSteps: 0, value: 0 };
        agg[name].caseCount++;
        agg[name].units += c.items.reduce((s, i) => s + i.units, 0);
        agg[name].completedSteps += c.schedule.length;
        agg[name].value += money(c.totalValue);
      }
      const rows = Object.values(agg).sort((a, b) => b.value - a.value).map((r) => ({
        technician: r.name,
        cases: r.caseCount,
        units: r.units,
        stepsCompleted: r.completedSteps,
        value: fmt(r.value),
      }));
      return {
        title: "Tech Productivity Analysis",
        subtitle: `${fmtDate(from)} – ${fmtDate(toEnd)}`,
        columns: [
          { key: "technician", label: "Technician" },
          { key: "cases", label: "Cases", align: "right", type: "number" },
          { key: "units", label: "Units", align: "right", type: "number" },
          { key: "stepsCompleted", label: "Steps Done", align: "right", type: "number" },
          { key: "value", label: "Total Value", align: "right", type: "currency" },
        ],
        rows,
        totals: {
          cases: rows.reduce((s, r) => s + (r.cases as number), 0),
          units: rows.reduce((s, r) => s + (r.units as number), 0),
          value: rows.reduce((s, r) => s + (r.value as number), 0),
        },
      };
    }

    case "value-of-wip": {
      const cases = await prisma.case.findMany({
        where: { status: { in: ["IN_LAB", "WIP", "HOLD"] } },
        include: {
          dentalAccount: { select: { name: true, doctorName: true } },
          items: { select: { productType: true, units: true } },
        },
        orderBy: { receivedDate: "asc" },
      });
      const rows = cases.map((c) => ({
        caseNumber: c.caseNumber,
        status: c.status,
        doctor: c.dentalAccount.doctorName ? `Dr. ${c.dentalAccount.doctorName}` : c.dentalAccount.name,
        practice: c.dentalAccount.name,
        patient: c.patientName,
        products: c.items.map((i) => `${i.productType} ×${i.units}`).join(", "),
        received: fmtDate(c.receivedDate),
        due: fmtDate(c.dueDate),
        value: fmt(c.totalValue),
      }));
      return {
        title: "Value of WIP",
        columns: [
          { key: "caseNumber", label: "Case #" },
          { key: "status", label: "Status" },
          { key: "doctor", label: "Doctor" },
          { key: "practice", label: "Practice" },
          { key: "patient", label: "Patient" },
          { key: "products", label: "Products" },
          { key: "received", label: "Received" },
          { key: "due", label: "Due" },
          { key: "value", label: "Value", align: "right", type: "currency" },
        ],
        rows,
        totals: { value: cases.reduce((s, c) => s + money(c.totalValue), 0) },
      };
    }

    default:
      return { title: "Unknown Report", columns: [], rows: [] };
  }
}

export async function POST(req: NextRequest) {
  const { report, from, to } = await req.json();
  if (!report) return NextResponse.json({ error: "report is required" }, { status: 400 });

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();

  try {
    const result = await runReport(report, { from: fromDate, to: toDate });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
