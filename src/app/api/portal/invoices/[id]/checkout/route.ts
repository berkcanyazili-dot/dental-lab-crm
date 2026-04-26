import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getDoctorSession } from "@/server/services/portal";

function moneyToCents(value: Prisma.Decimal | number | string) {
  const amount = typeof value === "string" ? Number(value) : Number(value);
  return Math.round(amount * 100);
}

function getAppBaseUrl(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const doctor = await getDoctorSession();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: params.id,
      tenantId: doctor.tenantId,
      dentalAccountId: doctor.dentalAccountId,
      status: { in: ["OPEN", "PARTIAL"] },
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          patientName: true,
        },
      },
      dentalAccount: {
        select: {
          name: true,
          doctorName: true,
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const balanceCents = moneyToCents(invoice.balance);
  if (balanceCents <= 0) {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  const settings = await prisma.labSettings.findUnique({ where: { tenantId: doctor.tenantId } });
  const stripe = getStripe();
  const applicationFeeAmount =
    settings?.stripeApplicationFeeBasisPoints && settings.stripeApplicationFeeBasisPoints > 0
      ? Math.round((balanceCents * settings.stripeApplicationFeeBasisPoints) / 10000)
      : undefined;

  const appBaseUrl = getAppBaseUrl(request);
  const successUrl = `${appBaseUrl}/portal?paid=1`;
  const cancelUrl = `${appBaseUrl}/portal?pay_cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: doctor.email ?? invoice.dentalAccount.email ?? undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: balanceCents,
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `${invoice.case.caseNumber} - ${invoice.case.patientName}`,
          },
        },
      },
    ],
    metadata: {
      invoiceId: invoice.id,
      caseId: invoice.caseId,
      caseNumber: invoice.case.caseNumber,
      dentalAccountId: invoice.dentalAccountId,
    },
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: settings?.stripeConnectedAccountId
        ? {
            destination: settings.stripeConnectedAccountId,
          }
        : undefined,
      metadata: {
        invoiceId: invoice.id,
        caseId: invoice.caseId,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
