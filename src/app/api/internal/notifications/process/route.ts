import { NextRequest, NextResponse } from "next/server";
import { processPendingNotificationJobs } from "@/server/services/doctorNotifications";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const internalAuth = request.headers.get("x-internal-auth");
  if (!process.env.NEXTAUTH_SECRET || internalAuth !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const limit =
    typeof body?.limit === "number" && body.limit > 0
      ? Math.min(body.limit, 25)
      : 10;

  const result = await processPendingNotificationJobs(limit);
  return NextResponse.json(result);
}
