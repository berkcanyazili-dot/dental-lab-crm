import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const accountId = searchParams.get("accountId");
  const caseNumber = searchParams.get("caseNumber");

  const cases = await prisma.case.findMany({
    where: {
      ...(status ? { status: status.includes(",") ? { in: status.split(",") } : status } : {}),
      ...(accountId ? { dentalAccountId: accountId } : {}),
      ...(caseNumber ? { caseNumber: { contains: caseNumber.toUpperCase() } } : {}),
    },
    include: { dentalAccount: true, technician: true, items: true, schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { receivedDate: "desc" },
  });
  return NextResponse.json(cases);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items, generateSchedule, _authorName, ...caseData } = body;

  const count = await prisma.case.count();
  const caseNumber = `DL-${String(count + 1).padStart(5, "0")}`;
  const totalValue = (items || []).reduce(
    (s: number, i: { price: number; units: number }) => s + i.price * i.units,
    0
  );

  const DEPARTMENTS = ["Scan", "Design", "Milling", "C&B QC", "Stain & Glaze", "Final QC", "Shipping"];

  const newCase = await prisma.case.create({
    data: {
      ...caseData,
      caseNumber,
      totalValue,
      items: { create: items || [] },
      audits: {
        create: [{ action: "CASE_CREATED", details: `Case ${caseNumber} created`, authorName: _authorName ?? "Staff" }],
      },
      ...(generateSchedule
        ? {
            schedule: {
              create: DEPARTMENTS.map((dept, i) => ({ department: dept, sortOrder: i, status: "SCHEDULED" })),
            },
          }
        : {}),
    },
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
      schedule: { include: { technician: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json(newCase, { status: 201 });
}
