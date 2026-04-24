import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEPARTMENTS = [
  "Scan", "Design", "Milling", "C&B QC", "Stain & Glaze", "Final QC", "Shipping",
];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const steps = await prisma.deptSchedule.findMany({
    where: { caseId: params.id },
    include: { technician: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(steps);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (body.generate) {
    await prisma.deptSchedule.deleteMany({ where: { caseId: params.id } });
    const steps = await Promise.all(
      DEPARTMENTS.map((dept, i) =>
        prisma.deptSchedule.create({
          data: { caseId: params.id, department: dept, sortOrder: i, status: "SCHEDULED" },
          include: { technician: true },
        })
      )
    );
    await prisma.caseAudit.create({
      data: { caseId: params.id, action: "SCHEDULE_GENERATED", details: `Generated ${steps.length} department steps`, authorName: body.authorName ?? "Staff" },
    });
    return NextResponse.json(steps, { status: 201 });
  }
  const step = await prisma.deptSchedule.create({
    data: { caseId: params.id, ...body },
    include: { technician: true },
  });
  return NextResponse.json(step, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id, ...data } = await req.json();
  const step = await prisma.deptSchedule.update({
    where: { id },
    data,
    include: { technician: true },
  });
  await prisma.caseAudit.create({
    data: {
      caseId: params.id,
      action: "SCHEDULE_UPDATED",
      details: `${step.department} → ${step.status}`,
      authorName: data.authorName ?? "Staff",
    },
  });
  return NextResponse.json(step);
}
