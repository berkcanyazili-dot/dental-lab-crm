import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const techId = searchParams.get("technicianId");

  const activities = await prisma.techActivity.findMany({
    where: techId ? { technicianId: techId } : {},
    include: { technician: true, case: { include: { items: true, dentalAccount: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(activities);
}

export async function POST(req: NextRequest) {
  const { technicianId, caseId, scheduleId: rawScheduleId, type, notes } = await req.json();

  if (!technicianId) {
    return NextResponse.json({ error: "technicianId is required" }, { status: 400 });
  }

  // Auto-find first actionable step when no scheduleId provided
  let scheduleId = rawScheduleId ?? null;
  if (!scheduleId && caseId && type === "CHECKIN") {
    const step = await prisma.deptSchedule.findFirst({
      where: { caseId, status: { in: ["SCHEDULED", "READY"] } },
      orderBy: { sortOrder: "asc" },
    });
    if (step) scheduleId = step.id;
  }

  const activity = await prisma.techActivity.create({
    data: { technicianId, caseId, scheduleId, type, notes },
    include: { technician: true, case: true },
  });

  if (scheduleId) {
    const newStatus = type === "CHECKIN" ? "IN_PROCESS" : "COMPLETE";
    await prisma.deptSchedule.update({
      where: { id: scheduleId },
      data: {
        status: newStatus,
        technicianId,
        ...(newStatus === "COMPLETE" ? { completedDate: new Date() } : {}),
      },
    });
  }

  if (caseId) {
    await prisma.caseAudit.create({
      data: {
        caseId,
        action: type === "CHECKIN" ? "TECH_CHECKIN" : "TECH_CHECKOUT",
        details: `Technician ${type === "CHECKIN" ? "checked in" : "checked out"}`,
        authorName: activity.technician.name,
      },
    });
  }

  return NextResponse.json(activity, { status: 201 });
}
