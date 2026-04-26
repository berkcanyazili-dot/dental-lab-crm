import Link from "next/link";
import { AlertCircle, CheckCircle2, CreditCard, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionTenant } from "@/server/services/tenant";
import { isTenantSubscriptionActive } from "@/server/services/subscriptions";

export default async function BillingUpgradePage({
  searchParams,
}: {
  searchParams?: {
    success?: string;
    canceled?: string;
    alreadyActive?: string;
  };
}) {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: sessionTenant.tenantId },
    select: {
      name: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
      stripeSubscriptionCurrentPeriodEnd: true,
    },
  });

  const isActive = isTenantSubscriptionActive(tenant);
  const canManageBilling = ["ADMIN", "STAFF"].includes(sessionTenant.role ?? "");

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-sky-500/15 p-3 text-sky-300">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Subscription Required</h1>
              <p className="mt-2 text-sm text-gray-300">
                Your tenant needs an active subscription before users can continue using the CRM and upload storage.
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Plans can include a base storage allowance with metered overage billing for large STL and scan libraries.
              </p>
              {tenant?.name && (
                <p className="mt-2 text-sm text-sky-300">
                  Tenant: {tenant.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {searchParams?.success === "1" && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-200">
            <CheckCircle2 className="h-4 w-4" />
            Stripe checkout completed. The subscription status should unlock the app shortly.
          </div>
        )}

        {searchParams?.canceled === "1" && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <AlertCircle className="h-4 w-4" />
            Subscription checkout was canceled. No changes were made.
          </div>
        )}

        {searchParams?.alreadyActive === "1" && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-200">
            <CheckCircle2 className="h-4 w-4" />
            This tenant already has an active subscription.
          </div>
        )}

        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Current billing state</h2>
            <p className="mt-2 text-sm text-gray-400">
              Subscription ID: {tenant?.stripeSubscriptionId ?? "Not connected"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Status: {tenant?.stripeSubscriptionStatus ?? "inactive"}
            </p>
          </div>

          {isActive ? (
            <div className="rounded-xl border border-green-800 bg-green-950/30 p-4 text-sm text-green-200">
              Billing is active. You can go back into the CRM.
              <div className="mt-3">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500"
                >
                  Return to dashboard
                </Link>
              </div>
            </div>
          ) : canManageBilling ? (
            <div>
              <p className="mb-4 text-sm text-gray-300">
                Start the Stripe subscription checkout to unlock the tenant. You can combine a base monthly fee with
                metered storage overage for larger labs.
              </p>
              <a
                href="/api/billing/subscription/checkout"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500"
              >
                <CreditCard className="h-4 w-4" />
                Upgrade and Subscribe
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
              Your lab subscription is inactive. Please ask an admin or billing manager to complete the upgrade.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
