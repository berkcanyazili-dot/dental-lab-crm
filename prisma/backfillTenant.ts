import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default-lab" },
    update: {},
    create: {
      name: "Default Dental Lab",
      slug: "default-lab",
    },
  });

  await prisma.$transaction([
    prisma.dentalAccount.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.technician.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.case.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.invoice.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.payment.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.labSettings.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.shopifySettings.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.serviceProduct.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
    prisma.workflowStepTemplate.updateMany({
      where: { tenantId: { equals: null } },
      data: { tenantId: tenant.id },
    }),
  ]);

  console.log(`Backfilled existing rows to tenant ${tenant.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
