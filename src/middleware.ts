import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/shopify/webhook",
  "/api/stripe/webhook",
  "/api/internal/tenant-subscription",
];

function isPublicApiRoute(pathname: string) {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isApiRoute(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isUpgradePath = pathname === "/billing/upgrade" || pathname.startsWith("/billing/upgrade/");
  const isSubscriptionCheckoutPath =
    pathname === "/api/billing/subscription/checkout" ||
    pathname.startsWith("/api/billing/subscription/checkout/");

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) {
    const role = token.role;
    const tenantId = typeof token.tenantId === "string" ? token.tenantId : null;
    const isDoctor = role === "DOCTOR";
    const isTechnician = role === "TECHNICIAN";
    const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");
    const isPortalApiPath = pathname === "/api/portal" || pathname.startsWith("/api/portal/");
    const isTechPath = pathname === "/tech" || pathname.startsWith("/tech/");
    const isTechApiPath = pathname === "/api/tech" || pathname.startsWith("/api/tech/");

    if (tenantId && !isUpgradePath && !isSubscriptionCheckoutPath && !pathname.startsWith("/api/auth")) {
      try {
        const subscriptionResponse = await fetch(
          new URL(`/api/internal/tenant-subscription?tenantId=${tenantId}`, request.url),
          {
            headers: {
              "x-internal-auth": process.env.NEXTAUTH_SECRET ?? "",
            },
            cache: "no-store",
          }
        );

        if (subscriptionResponse.ok) {
          const subscription = (await subscriptionResponse.json()) as { active?: boolean };
          if (!subscription.active) {
            if (isApiRoute(pathname)) {
              return NextResponse.json({ error: "Subscription required" }, { status: 402 });
            }
            const upgradeUrl = request.nextUrl.clone();
            upgradeUrl.pathname = "/billing/upgrade";
            return NextResponse.redirect(upgradeUrl);
          }
        }
      } catch {
        if (isApiRoute(pathname)) {
          return NextResponse.json({ error: "Subscription check failed" }, { status: 503 });
        }
        const upgradeUrl = request.nextUrl.clone();
        upgradeUrl.pathname = "/billing/upgrade";
        return NextResponse.redirect(upgradeUrl);
      }
    }

    if (isDoctor && pathname === "/") {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/portal";
      return NextResponse.redirect(portalUrl);
    }

    if (isDoctor && !isPortalPath && !isPortalApiPath && !pathname.startsWith("/api/auth")) {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/portal";
      return NextResponse.redirect(portalUrl);
    }

    if (isTechnician && pathname === "/") {
      const techUrl = request.nextUrl.clone();
      techUrl.pathname = "/tech";
      return NextResponse.redirect(techUrl);
    }

    if (isTechnician && !isTechPath && !isTechApiPath && !pathname.startsWith("/api/auth")) {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const techUrl = request.nextUrl.clone();
      techUrl.pathname = "/tech";
      return NextResponse.redirect(techUrl);
    }

    return NextResponse.next();
  }

  if (isApiRoute(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/login";
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/",
    "/accounting/:path*",
    "/accounts/:path*",
    "/billing/:path*",
    "/cases/:path*",
    "/cases-in-lab/:path*",
    "/dispatch/:path*",
    "/fda-lots/:path*",
    "/history/:path*",
    "/hold/:path*",
    "/incoming/:path*",
    "/outgoing/:path*",
    "/portal/:path*",
    "/remakes/:path*",
    "/reports/:path*",
    "/sales/:path*",
    "/settings/:path*",
    "/tech/:path*",
    "/technicians/:path*",
    "/wip/:path*",
  ],
};
