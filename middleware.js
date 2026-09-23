import { NextResponse } from "next/server";

const SESSION_COOKIE = "ehga_session";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow login page, login/logout APIs and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
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
  matcher: ["/app/:path*", "/api/:path*", "/"],
};
