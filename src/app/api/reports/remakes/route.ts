import { NextResponse } from "next/server";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionTenant } from "@/server/services/tenant";

export async function GET() {
  const sessionTenant = await getSessionTenant();
  if (!sessionTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prisma = getTenantPrisma(sessionTenant.tenantId);
  const remakes = await prisma.case.findMany({
    where: {
      deletedAt: null,
      caseType: "REMAKE",
      remakeFault: "CLINIC",
    },
    select: {
      id: true,
      caseNumber: true,
      patientName: true,
      remakeReason: true,
      remakeFault: true,
      totalValue: true,
      dentalAccount: {
        select: {
          id: true,
          name: true,
          doctorName: true,
        },
      },
    },
  });

  const byDoctor = new Map<
    string,
    {
      dentalAccountId: string;
      accountName: string;
      doctorName: string;
      remakeCount: number;
      remakeCost: number;
      reasons: Record<string, number>;
    }
  >();

  for (const remake of remakes) {
    const doctorKey = remake.dentalAccount.id;
    const current = byDoctor.get(doctorKey) ?? {
      dentalAccountId: remake.dentalAccount.id,
      accountName: remake.dentalAccount.name,
      doctorName: remake.dentalAccount.doctorName ?? "Unknown Doctor",
      remakeCount: 0,
      remakeCost: 0,
      reasons: {},
    };

    current.remakeCount += 1;
    current.remakeCost += Number(remake.totalValue);

    const reasonKey = remake.remakeReason ?? "UNSPECIFIED";
    current.reasons[reasonKey] = (current.reasons[reasonKey] ?? 0) + 1;

    byDoctor.set(doctorKey, current);
  }

  const rankedDoctors = Array.from(byDoctor.values())
    .sort((a, b) => b.remakeCost - a.remakeCost)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
      remakeCost: Number(entry.remakeCost.toFixed(2)),
    }));

  return NextResponse.json({
    totalClinicFaultRemakes: remakes.length,
    rankedDoctors,
  });
}
