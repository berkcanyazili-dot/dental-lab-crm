export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export interface TenantSubscriptionLike {
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripeSubscriptionCurrentPeriodEnd?: Date | null;
}

export function isTenantSubscriptionActive(
  tenant: TenantSubscriptionLike | null | undefined
) {
  if (!tenant?.stripeSubscriptionId) {
    return false;
  }

  const status = tenant.stripeSubscriptionStatus?.toLowerCase() ?? null;
  if (!status || !ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return false;
  }

  if (
    tenant.stripeSubscriptionCurrentPeriodEnd &&
    tenant.stripeSubscriptionCurrentPeriodEnd.getTime() < Date.now()
  ) {
    return false;
  }

  return true;
}
