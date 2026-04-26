import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_PRODUCTS = [
  ["Fixed", "Crown", 250],
  ["Fixed", "Implant Crown", 350],
  ["Fixed", "Full Arch Restoration", 1200],
  ["Fixed", "Anterior Zirconia", 200],
  ["Fixed", "Posterior Zirconia", 250],
  ["Fixed", "PFM High Noble Yellow", 240],
  ["Fixed", "PFM High Noble White", 240],
  ["Fixed", "Veneer Pressable", 112.5],
  ["Removable", "Denture", 550],
  ["Removable", "Acrylic Partial", 330],
  ["Removable", "Cast Partial", 420],
  ["Ortho", "Ortho Retainer", 180],
  ["Implant", "Soft Tissue", 0],
  ["Implant", "Custom Tray", 120],
] as const;

const DEFAULT_WORKFLOW = [
  ["Scan", 0, 1],
  ["Design", 1, 1],
  ["Milling", 2, 1],
  ["C&B QC", 3, 1],
  ["Stain & Glaze", 4, 1],
  ["Final QC", 5, 1],
  ["Shipping", 6, 1],
] as const;

export async function ensureLabDefaults(tenantId: string) {
  const settings = await prisma.labSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });

  for (const [department, name, defaultPrice] of DEFAULT_PRODUCTS) {
    await prisma.serviceProduct.upsert({
      where: { tenantId_department_name: { tenantId, department, name } },
      update: {},
      create: {
        tenantId,
        department,
        name,
        defaultPrice: new Prisma.Decimal(defaultPrice),
        sortOrder: DEFAULT_PRODUCTS.findIndex((product) => product[0] === department && product[1] === name),
      },
    });
  }

  for (const [department, sortOrder, leadDays] of DEFAULT_WORKFLOW) {
    await prisma.workflowStepTemplate.upsert({
      where: { tenantId_department: { tenantId, department } },
      update: {},
      create: { tenantId, department, sortOrder, leadDays },
    });
  }

  return settings;
}

export async function getLabSettingsBundle(tenantId: string) {
  await ensureLabDefaults(tenantId);
  const [settings, products, workflow] = await Promise.all([
    prisma.labSettings.findUnique({ where: { tenantId } }),
    prisma.serviceProduct.findMany({
      where: { tenantId },
      orderBy: [{ department: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.workflowStepTemplate.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { department: "asc" }],
    }),
  ]);

  return { settings, products, workflow };
}

export async function getActiveWorkflowTemplates(
  client: unknown = prisma,
  tenantId: string
) {
  if (client === prisma) {
    await ensureLabDefaults(tenantId);
  }
  const workflowClient = client as {
    workflowStepTemplate: {
      findMany: (args: {
        where: { tenantId: string; isActive: true };
        orderBy: Array<{ sortOrder: "asc" } | { department: "asc" }>;
      }) => Promise<Array<{ department: string; sortOrder: number; leadDays: number; isActive: boolean }>>;
    };
  };
  return workflowClient.workflowStepTemplate.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { department: "asc" }],
  });
}
