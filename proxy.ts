import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/** Signed-out visitors sign in first, except on chat links, which may be shared. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (getSessionCookie(request) || pathname.startsWith("/c/")) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = { matcher: ["/", "/c/:path*"] };
