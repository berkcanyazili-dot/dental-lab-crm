import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAuthorName } from "@/server/services/authorship";
import { getActiveWorkflowTemplates } from "@/server/services/labSettings";

const createScheduleSchema = z
  .object({
    department: z.string().trim().min(1),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    status: z.enum(["SCHEDULED", "READY", "IN_PROCESS", "COMPLETE"]).optional(),
    technicianId: z.string().trim().min(1).optional().nullable(),
    scheduledDate: z.coerce.date().optional().nullable(),
    completedDate: z.coerce.date().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

const patchScheduleSchema = z
  .object({
    id: z.string().trim().min(1),
    department: z.string().trim().min(1).optional(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    status: z.enum(["SCHEDULED", "READY", "IN_PROCESS", "COMPLETE"]).optional(),
    technicianId: z.string().trim().min(1).optional().nullable(),
    scheduledDate: z.coerce.date().optional().nullable(),
    completedDate: z.coerce.date().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

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
  const authorName = await getSessionAuthorName();
  if (body.generate) {
    await prisma.deptSchedule.deleteMany({ where: { caseId: params.id } });
    const templates = await getActiveWorkflowTemplates();
    const steps = await Promise.all(
      templates.map((template) =>
        prisma.deptSchedule.create({
          data: {
            caseId: params.id,
            department: template.department,
            sortOrder: template.sortOrder,
            status: "SCHEDULED",
          },
          include: { technician: true },
        })
      )
    );
    await prisma.caseAudit.create({
      data: { caseId: params.id, action: "SCHEDULE_GENERATED", details: `Generated ${steps.length} department steps`, authorName },
    });
    return NextResponse.json(steps, { status: 201 });
  }

  const parsed = createScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid schedule payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const step = await prisma.deptSchedule.create({
    data: { caseId: params.id, ...parsed.data },
    include: { technician: true },
  });
  return NextResponse.json(step, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = patchScheduleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid schedule payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const authorName = await getSessionAuthorName();
  const { id, ...data } = parsed.data;
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
      authorName,
    },
  });
  return NextResponse.json(step);
}
