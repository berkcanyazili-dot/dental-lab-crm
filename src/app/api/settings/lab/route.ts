import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { ensureLabDefaults, getLabSettingsBundle } from "@/server/services/labSettings";
import { getSessionTenant } from "@/server/services/tenant";

const labSettingsSchema = z
  .object({
    labName: z.string().trim().min(1),
    phone: z.string().trim().optional().nullable(),
    email: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    zip: z.string().trim().optional().nullable(),
    defaultTurnaroundDays: z.coerce.number().int().positive().default(7),
    defaultShippingCarrier: z.string().trim().optional().nullable(),
    defaultShippingTime: z.string().trim().optional().nullable(),
    workTicketFooter: z.string().trim().optional().nullable(),
    stripeConnectedAccountId: z.string().trim().optional().nullable(),
    stripeApplicationFeeBasisPoints: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

const productSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    department: z.string().trim().min(1),
    defaultPrice: z.coerce.number().nonnegative().default(0),
    isActive: z.coerce.boolean().default(true),
    sortOrder: z.coerce.number().int().nonnegative().default(0),
  })
  .strict();

const workflowSchema = z
  .object({
    id: z.string().optional(),
    department: z.string().trim().min(1),
    sortOrder: z.coerce.number().int().nonnegative().default(0),
    leadDays: z.coerce.number().int().positive().default(1),
    isActive: z.coerce.boolean().default(true),
  })
  .strict();

const updateBundleSchema = z
  .object({
    settings: labSettingsSchema,
    products: z.array(productSchema),
    workflow: z.array(workflowSchema),
  })
  .strict();

export async function GET() {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bundle = await getLabSettingsBundle(sessionTenant.tenantId);
  return NextResponse.json(bundle);
}

export async function POST(request: NextRequest) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = getTenantPrisma(sessionTenant.tenantId);

  await ensureLabDefaults(sessionTenant.tenantId);
  const parsed = updateBundleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lab settings payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { settings, products, workflow } = parsed.data;
  const requestedProductIds = products.map((product) => product.id).filter(Boolean) as string[];
  const requestedWorkflowIds = workflow.map((step) => step.id).filter(Boolean) as string[];

  const [ownedProducts, ownedWorkflow] = await Promise.all([
    requestedProductIds.length > 0
      ? prisma.serviceProduct.findMany({
          where: { id: { in: requestedProductIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    requestedWorkflowIds.length > 0
      ? prisma.workflowStepTemplate.findMany({
          where: { id: { in: requestedWorkflowIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  if (ownedProducts.length !== requestedProductIds.length) {
    return NextResponse.json({ error: "Invalid product id for current tenant" }, { status: 400 });
  }

  if (ownedWorkflow.length !== requestedWorkflowIds.length) {
    return NextResponse.json({ error: "Invalid workflow step id for current tenant" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.labSettings.upsert({
      where: { tenantId: sessionTenant.tenantId },
      update: {
        labName: settings.labName,
        phone: settings.phone || null,
        email: settings.email || null,
        address: settings.address || null,
        city: settings.city || null,
        state: settings.state || null,
        zip: settings.zip || null,
        defaultTurnaroundDays: settings.defaultTurnaroundDays,
        defaultShippingCarrier: settings.defaultShippingCarrier || null,
        defaultShippingTime: settings.defaultShippingTime || null,
        workTicketFooter: settings.workTicketFooter || null,
        stripeConnectedAccountId: settings.stripeConnectedAccountId || null,
        stripeApplicationFeeBasisPoints: settings.stripeApplicationFeeBasisPoints,
      },
      create: {
        tenantId: sessionTenant.tenantId,
        labName: settings.labName,
        phone: settings.phone || null,
        email: settings.email || null,
        address: settings.address || null,
        city: settings.city || null,
        state: settings.state || null,
        zip: settings.zip || null,
        defaultTurnaroundDays: settings.defaultTurnaroundDays,
        defaultShippingCarrier: settings.defaultShippingCarrier || null,
        defaultShippingTime: settings.defaultShippingTime || null,
        workTicketFooter: settings.workTicketFooter || null,
        stripeConnectedAccountId: settings.stripeConnectedAccountId || null,
        stripeApplicationFeeBasisPoints: settings.stripeApplicationFeeBasisPoints,
      },
    });

    await tx.serviceProduct.deleteMany({
      where: {
        tenantId: sessionTenant.tenantId,
        id: { notIn: products.map((product) => product.id).filter(Boolean) as string[] },
      },
    });
    for (const product of products) {
      await tx.serviceProduct.upsert({
        where: product.id
          ? { id: product.id }
          : { tenantId_department_name: { tenantId: sessionTenant.tenantId, department: product.department, name: product.name } },
        update: {
          name: product.name,
          department: product.department,
          defaultPrice: new Prisma.Decimal(product.defaultPrice),
          isActive: product.isActive,
          sortOrder: product.sortOrder,
        },
        create: {
          tenantId: sessionTenant.tenantId,
          name: product.name,
          department: product.department,
          defaultPrice: new Prisma.Decimal(product.defaultPrice),
          isActive: product.isActive,
          sortOrder: product.sortOrder,
        },
      });
    }

    await tx.workflowStepTemplate.deleteMany({
      where: {
        tenantId: sessionTenant.tenantId,
        id: { notIn: workflow.map((step) => step.id).filter(Boolean) as string[] },
      },
    });
    for (const step of workflow) {
      await tx.workflowStepTemplate.upsert({
        where: step.id
          ? { id: step.id }
          : { tenantId_department: { tenantId: sessionTenant.tenantId, department: step.department } },
        update: {
          department: step.department,
          sortOrder: step.sortOrder,
          leadDays: step.leadDays,
          isActive: step.isActive,
        },
        create: {
          tenantId: sessionTenant.tenantId,
          department: step.department,
          sortOrder: step.sortOrder,
          leadDays: step.leadDays,
          isActive: step.isActive,
        },
      });
    }
  });

  const bundle = await getLabSettingsBundle(sessionTenant.tenantId);
  return NextResponse.json({ success: true, ...bundle });
}
