import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_PORTAL_TENANT_COOKIE } from "@/lib/portal";
import { getDoctorSession } from "@/server/services/portal";

export async function POST(request: NextRequest) {
  const doctor = await getDoctorSession();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { tenantId?: string } | null;
  const tenantId = body?.tenantId?.trim();

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant is required" }, { status: 400 });
  }

  const matchingAccess = doctor.accessibleLabs.find((access) => access.tenantId === tenantId);
  if (!matchingAccess?.dentalAccountId) {
    return NextResponse.json({ error: "Lab access not found" }, { status: 404 });
  }

  const response = NextResponse.json({
    ok: true,
    tenantId: matchingAccess.tenantId,
    tenantName: matchingAccess.tenantName,
    dentalAccountId: matchingAccess.dentalAccountId,
    dentalAccountName: matchingAccess.dentalAccountName,
  });

  response.cookies.set(ACTIVE_PORTAL_TENANT_COOKIE, matchingAccess.tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
