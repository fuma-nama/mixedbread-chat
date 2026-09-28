import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/** Starts a guest session, then returns to the page that sent the visitor here. */
export async function GET(request: NextRequest) {
  await auth.api.signInAnonymous({ headers: request.headers });

  const to = request.nextUrl.searchParams.get("redirect") ?? "/";
  redirect(to.startsWith("/") && !to.startsWith("//") ? to : "/");
}
