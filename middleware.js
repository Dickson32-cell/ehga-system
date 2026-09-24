import { NextResponse } from "next/server";

const SESSION_COOKIE = "ehga_session";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow: staff login page, CUSTOMER PORTAL (pages + APIs), auth
  // APIs, payment webhook and static assets. The portal enforces its own
  // customer sessions server-side on every page and route.
  if (
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/portal") ||
    pathname.startsWith("/api/push") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/paystack") ||
    pathname === "/api/momo-number" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Cheap gate only: signature + roles are verified server-side on every page/API.
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*", "/", "/portal/:path*"],
};
