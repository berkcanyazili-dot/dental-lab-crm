import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDoctorSession } from "@/server/services/portal";

export async function GET() {
  const doctor = await getDoctorSession();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.dentalAccount.findFirst({
    where: { id: doctor.dentalAccountId, tenantId: doctor.tenantId },
    select: {
      id: true,
      name: true,
      doctorName: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      _count: { select: { cases: true } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ ...account, user: doctor });
}
