import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ClientLike = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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

export async function ensureLabDefaults() {
  const settings = await prisma.labSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  for (const [department, name, defaultPrice] of DEFAULT_PRODUCTS) {
    await prisma.serviceProduct.upsert({
      where: { department_name: { department, name } },
      update: {},
      create: {
        department,
        name,
        defaultPrice: new Prisma.Decimal(defaultPrice),
        sortOrder: DEFAULT_PRODUCTS.findIndex((product) => product[0] === department && product[1] === name),
      },
    });
  }

  for (const [department, sortOrder, leadDays] of DEFAULT_WORKFLOW) {
    await prisma.workflowStepTemplate.upsert({
      where: { department },
      update: {},
      create: { department, sortOrder, leadDays },
    });
  }

  return settings;
}

export async function getLabSettingsBundle() {
  await ensureLabDefaults();
  const [settings, products, workflow] = await Promise.all([
    prisma.labSettings.findUnique({ where: { id: "default" } }),
    prisma.serviceProduct.findMany({
      orderBy: [{ department: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.workflowStepTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { department: "asc" }],
    }),
  ]);

  return { settings, products, workflow };
}

export async function getActiveWorkflowTemplates(client: ClientLike = prisma) {
  if (client === prisma) {
    await ensureLabDefaults();
  }
  return client.workflowStepTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { department: "asc" }],
  });
}
