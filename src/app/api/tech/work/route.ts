import { NextRequest, NextResponse } from "next/server";
import { CaseStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTechnicianSession } from "@/server/services/technicianPortal";

const actionSchema = z
  .object({
    action: z.enum(["START_STEP", "COMPLETE_STEP", "RELEASE_STEP"]),
    caseId: z.string().trim().min(1),
    scheduleId: z.string().trim().min(1),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

function canActOnStep(step: { technicianId: string | null }, technicianId: string) {
  return !step.technicianId || step.technicianId === technicianId;
}

export async function GET() {
  const techSession = await getTechnicianSession();
  if (!techSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const technician = await prisma.technician.findUnique({
    where: { id: techSession.technicianId },
    select: { id: true, name: true, specialty: true },
  });

  if (!technician) {
    return NextResponse.json({ error: "Technician not found" }, { status: 404 });
  }

  const cases = await prisma.case.findMany({
    where: {
      status: { in: [CaseStatus.IN_LAB, CaseStatus.WIP, CaseStatus.REMAKE] },
      OR: [
        { technicianId: techSession.technicianId },
        { schedule: { some: { technicianId: techSession.technicianId, status: { in: ["SCHEDULED", "READY", "IN_PROCESS"] } } } },
        { schedule: { some: { technicianId: null, status: { in: ["SCHEDULED", "READY"] } } } },
      ],
    },
    include: {
      dentalAccount: true,
      technician: true,
      items: true,
      schedule: {
        include: { technician: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { receivedDate: "desc" }],
  });

  return NextResponse.json({ technician, cases });
}

export async function POST(request: NextRequest) {
  const techSession = await getTechnicianSession();
  if (!techSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid technician action", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { action, caseId, scheduleId, notes } = parsed.data;
  const step = await prisma.deptSchedule.findFirst({
    where: { id: scheduleId, caseId },
    include: { case: true, technician: true },
  });

  if (!step) {
    return NextResponse.json({ error: "Schedule step not found" }, { status: 404 });
  }

  if (!canActOnStep(step, techSession.technicianId)) {
    return NextResponse.json({ error: "Step is assigned to another technician" }, { status: 403 });
  }

  const technician = await prisma.technician.findUnique({
    where: { id: techSession.technicianId },
    select: { name: true },
  });
  const authorName = technician?.name ?? techSession.name ?? "Technician";

  const result = await prisma.$transaction(async (tx) => {
    if (action === "START_STEP") {
      const updatedStep = await tx.deptSchedule.update({
        where: { id: scheduleId },
        data: {
          status: "IN_PROCESS",
          technicianId: techSession.technicianId,
          notes: notes || step.notes,
        },
      });

      await tx.case.update({
        where: { id: caseId },
        data: { status: "WIP", technicianId: techSession.technicianId },
      });

      await tx.techActivity.create({
        data: {
          technicianId: techSession.technicianId,
          caseId,
          scheduleId,
          type: "CHECKIN",
          notes: notes || null,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId,
          action: "TECH_CHECKIN",
          details: `${authorName} started ${updatedStep.department}`,
          authorName,
        },
      });

      return updatedStep;
    }

    if (action === "RELEASE_STEP") {
      const updatedStep = await tx.deptSchedule.update({
        where: { id: scheduleId },
        data: {
          status: "READY",
          technicianId: null,
          notes: notes || step.notes,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId,
          action: "SCHEDULE_UPDATED",
          details: `${authorName} released ${updatedStep.department}`,
          authorName,
        },
      });

      return updatedStep;
    }

    const completedStep = await tx.deptSchedule.update({
      where: { id: scheduleId },
      data: {
        status: "COMPLETE",
        technicianId: techSession.technicianId,
        completedDate: new Date(),
        notes: notes || step.notes,
      },
    });

    await tx.techActivity.create({
      data: {
        technicianId: techSession.technicianId,
        caseId,
        scheduleId,
        type: "CHECKOUT",
        notes: notes || null,
      },
    });

    const nextStep = await tx.deptSchedule.findFirst({
      where: { caseId, status: "SCHEDULED", sortOrder: { gt: completedStep.sortOrder } },
      orderBy: { sortOrder: "asc" },
    });

    if (nextStep) {
      await tx.deptSchedule.update({
        where: { id: nextStep.id },
        data: { status: "READY" },
      });
    }

    const remaining = await tx.deptSchedule.count({
      where: { caseId, status: { not: "COMPLETE" } },
    });

    if (remaining === 0) {
      await tx.case.update({
        where: { id: caseId },
        data: { status: "COMPLETE" },
      });
    }

    await tx.caseAudit.create({
      data: {
        caseId,
        action: "TECH_CHECKOUT",
        details: `${authorName} completed ${completedStep.department}`,
        authorName,
      },
    });

    return completedStep;
  });

  return NextResponse.json(result);
}
