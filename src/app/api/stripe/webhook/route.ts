import { NextResponse } from "next/server";
import { Prisma, StripeWebhookEventStatus } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

function centsToDecimal(amount: number) {
  return new Prisma.Decimal(amount).dividedBy(100);
}

async function applyCheckoutPayment(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId || !session.amount_total) {
    return;
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { referenceId: session.id },
    select: { id: true },
  });

  if (existingPayment) {
    return;
  }

  const paymentAmount = centsToDecimal(session.amount_total);

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        tenantId: true,
        caseId: true,
        invoiceTotal: true,
      },
    });

    if (!invoice) {
      return;
    }

    await tx.payment.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId,
        amount: paymentAmount,
        paymentType: "CREDIT_CARD",
        referenceId: session.id,
        notes: "Stripe Checkout payment",
        externalAccountingId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      },
    });

    const paymentTotals = await tx.payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });

    const totalPaid = paymentTotals._sum.amount ?? new Prisma.Decimal(0);
    const remainingBalance = invoice.invoiceTotal.minus(totalPaid);
    const normalizedBalance = remainingBalance.lessThan(0) ? new Prisma.Decimal(0) : remainingBalance;
    const nextStatus =
      normalizedBalance.lessThanOrEqualTo(0)
        ? "PAID"
        : totalPaid.greaterThan(0)
          ? "PARTIAL"
          : "OPEN";

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        balance: normalizedBalance,
        status: nextStatus,
      },
    });

    await tx.case.update({
      where: { id: invoice.caseId },
      data: {
        isPaid: normalizedBalance.lessThanOrEqualTo(0),
      },
    });
  });
}

async function syncTenantSubscription(
  subscription: Stripe.Subscription,
  fallbackTenantId?: string | null
) {
  const tenantId =
    subscription.metadata?.tenantId ||
    fallbackTenantId ||
    null;

  const lookup = tenantId
    ? { id: tenantId }
    : typeof subscription.customer === "string"
      ? { stripeCustomerId: subscription.customer }
      : { stripeSubscriptionId: subscription.id };

  const tenant = await prisma.tenant.findFirst({
    where: lookup,
    select: { id: true },
  });

  if (!tenant) {
    return;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      stripeCustomerId:
        typeof subscription.customer === "string" ? subscription.customer : null,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripeSubscriptionCurrentPeriodEnd:
        subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000)
          : null,
    },
  });
}

async function clearTenantSubscription(subscription: Stripe.Subscription) {
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        ...(typeof subscription.customer === "string"
          ? [{ stripeCustomerId: subscription.customer }]
          : []),
      ],
    },
    select: { id: true },
  });

  if (!tenant) {
    return;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: subscription.status,
      stripeSubscriptionCurrentPeriodEnd:
        subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
    },
  });
}

async function claimWebhookEvent(event: Stripe.Event) {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { eventId: event.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        status: StripeWebhookEventStatus.PROCESSING,
        stripeCreated: new Date(event.created * 1000),
      },
    });
    return "claimed" as const;
  }

  if (existing.status === StripeWebhookEventStatus.PROCESSED) {
    return "already_processed" as const;
  }

  if (existing.status === StripeWebhookEventStatus.PROCESSING) {
    return "already_processing" as const;
  }

  const resumed = await prisma.stripeWebhookEvent.updateMany({
    where: {
      eventId: event.id,
      status: StripeWebhookEventStatus.FAILED,
    },
    data: {
      status: StripeWebhookEventStatus.PROCESSING,
      error: null,
    },
  });

  return resumed.count > 0 ? ("claimed" as const) : ("already_processing" as const);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature" },
      { status: 400 }
    );
  }

  const claim = await claimWebhookEvent(event);
  if (claim === "already_processed" || claim === "already_processing") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncTenantSubscription(subscription, session.metadata?.tenantId ?? null);
      } else {
        await applyCheckoutPayment(session);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncTenantSubscription(subscription);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await clearTenantSubscription(subscription);
    }

    await prisma.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: {
        status: StripeWebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    await prisma.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: {
        status: StripeWebhookEventStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown Stripe webhook error",
      },
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
