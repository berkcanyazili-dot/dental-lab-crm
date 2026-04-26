import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
        caseId: true,
        invoiceTotal: true,
      },
    });

    if (!invoice) {
      return;
    }

    await tx.payment.create({
      data: {
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

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    await applyCheckoutPayment(session);
  }

  return NextResponse.json({ received: true });
}
