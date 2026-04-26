import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTenantSubscriptionActive } from "@/server/services/subscriptions";

export async function GET(request: NextRequest) {
  const internalAuth = request.headers.get("x-internal-auth");
  if (!process.env.NEXTAUTH_SECRET || internalAuth !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId")?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
      stripeSubscriptionCurrentPeriodEnd: true,
    },
  });

  return NextResponse.json({
    active: isTenantSubscriptionActive(tenant),
  });
}
