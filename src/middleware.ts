import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/shopify/webhook",
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

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) {
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
    "/accounts/:path*",
    "/billing/:path*",
    "/cases/:path*",
    "/cases-in-lab/:path*",
    "/fda-lots/:path*",
    "/history/:path*",
    "/hold/:path*",
    "/incoming/:path*",
    "/outgoing/:path*",
    "/remakes/:path*",
    "/reports/:path*",
    "/sales/:path*",
    "/settings/:path*",
    "/technicians/:path*",
    "/wip/:path*",
  ],
};
