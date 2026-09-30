import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/** Signed-out visitors sign in before starting a chat. */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  // The query goes along, so a sign-in error reaches the sign-in page.
  return NextResponse.redirect(
    new URL(`/login${request.nextUrl.search}`, request.url),
  );
}

export const config = { matcher: "/" };
