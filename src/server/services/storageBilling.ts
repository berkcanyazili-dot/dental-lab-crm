import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const BYTES_PER_MEGABYTE = 1024 * 1024;

function getStorageMeterEventName() {
  return process.env.STRIPE_STORAGE_METER_EVENT_NAME?.trim() || "storage_mb_used";
}

function buildMeterIdentifier(tenantId: string, reason: string, sourceKey: string) {
  return `storage:${tenantId}:${reason}:${sourceKey}`.slice(0, 100);
}

export async function getTenantStoredAttachmentBytes(tenantId: string) {
  const totals = await prisma.attachment.aggregate({
    where: {
      case: {
        tenantId,
      },
    },
    _sum: {
      byteSize: true,
    },
  });

  return totals._sum.byteSize ?? 0;
}

export async function getTenantStoredAttachmentMegabytes(tenantId: string) {
  const totalBytes = await getTenantStoredAttachmentBytes(tenantId);
  return Math.ceil(totalBytes / BYTES_PER_MEGABYTE);
}

export async function reportTenantStorageUsageToStripe(
  tenantId: string,
  options: { reason: string; sourceKey: string }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      stripeCustomerId: true,
    },
  });

  if (!tenant?.stripeCustomerId) {
    return { reported: false as const, reason: "missing_customer" as const };
  }

  const eventName = getStorageMeterEventName();
  if (!eventName) {
    return { reported: false as const, reason: "missing_event_name" as const };
  }

  const megabytesUsed = await getTenantStoredAttachmentMegabytes(tenantId);
  const stripe = getStripe();

  await stripe.billing.meterEvents.create({
    event_name: eventName,
    payload: {
      stripe_customer_id: tenant.stripeCustomerId,
      value: String(megabytesUsed),
    },
    identifier: buildMeterIdentifier(tenantId, options.reason, options.sourceKey),
  });

  return {
    reported: true as const,
    megabytesUsed,
  };
}
