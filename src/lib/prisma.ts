import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  tenantPrismaClients: Map<string, TenantPrismaClient> | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const basePrisma =
  globalForPrisma.prisma ?? createPrismaClient();

const TENANT_SCOPED_MODELS = new Set([
  "Tenant",
  "User",
  "DentalAccount",
  "Case",
  "Technician",
  "Invoice",
  "Payment",
  "LabSettings",
  "ShopifySettings",
  "ServiceProduct",
  "WorkflowStepTemplate",
]);

function mergeTenantWhere(
  args: Record<string, unknown>,
  tenantId: string
) {
  const currentWhere = (args.where as Record<string, unknown> | undefined) ?? {};
  const currentTenantId = currentWhere.tenantId;

  if (
    currentTenantId !== undefined &&
    currentTenantId !== null &&
    currentTenantId !== tenantId
  ) {
    throw new Error("Cross-tenant Prisma query blocked.");
  }

  return {
    ...args,
    where: {
      ...currentWhere,
      tenantId,
    },
  };
}

function normalizeWriteData(
  data: Record<string, unknown> | Record<string, unknown>[] | undefined,
  tenantId: string
): Record<string, unknown> | Record<string, unknown>[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => normalizeWriteData(item, tenantId) as Record<string, unknown>);
  }

  const tenantValue = data.tenantId;
  if (tenantValue !== undefined && tenantValue !== null && tenantValue !== tenantId) {
    throw new Error("Cross-tenant Prisma write blocked.");
  }

  return {
    ...data,
    tenantId,
  };
}

function createTenantPrismaClient(tenantId: string) {
  return basePrisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          switch (operation) {
            case "findMany":
            case "findFirst":
            case "findFirstOrThrow":
            case "findUnique":
            case "findUniqueOrThrow":
            case "count":
            case "aggregate":
            case "groupBy":
            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany":
              return query(mergeTenantWhere(args as Record<string, unknown>, tenantId) as never);

            case "create":
              return query(({
                ...(args as Record<string, unknown>),
                data: normalizeWriteData(
                  (args as { data?: Record<string, unknown> }).data,
                  tenantId
                ),
              }) as never);

            case "createMany":
              return query(({
                ...(args as Record<string, unknown>),
                data: normalizeWriteData(
                  (args as { data?: Record<string, unknown>[] }).data,
                  tenantId
                ),
              }) as never);

            default:
              return query(args);
          }
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;

const tenantPrismaClients =
  globalForPrisma.tenantPrismaClients ?? new Map<string, TenantPrismaClient>();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
  globalForPrisma.tenantPrismaClients = tenantPrismaClients;
}

export function getTenantPrisma(tenantId: string) {
  const cached = tenantPrismaClients.get(tenantId);
  if (cached) {
    return cached;
  }

  const tenantClient = createTenantPrismaClient(tenantId);

  tenantPrismaClients.set(tenantId, tenantClient);
  return tenantClient;
}

export const prisma = basePrisma;
export type PrismaTransactionClient = Prisma.TransactionClient;
