import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getSessionTenant } from "@/server/services/tenant";
import { isTenantSubscriptionActive } from "@/server/services/subscriptions";

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function GET() {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["ADMIN", "STAFF"].includes(sessionTenant.role ?? "")) {
    return NextResponse.json({ error: "Only lab admins can manage subscriptions." }, { status: 403 });
  }

  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "STRIPE_SUBSCRIPTION_PRICE_ID is not configured." }, { status: 500 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: sessionTenant.tenantId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
      stripeSubscriptionCurrentPeriodEnd: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  if (isTenantSubscriptionActive(tenant)) {
    return NextResponse.redirect(new URL("/billing/upgrade?alreadyActive=1", getAppUrl()));
  }

  const stripe = getStripe();
  let customerId = tenant.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      email: sessionTenant.email ?? undefined,
      metadata: {
        tenantId: tenant.id,
      },
    });
    customerId = customer.id;

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl}/billing/upgrade?success=1`,
    cancel_url: `${appUrl}/billing/upgrade?canceled=1`,
    metadata: {
      tenantId: tenant.id,
    },
    subscription_data: {
      metadata: {
        tenantId: tenant.id,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe Checkout could not be created." }, { status: 500 });
  }

  return NextResponse.redirect(session.url);
}
