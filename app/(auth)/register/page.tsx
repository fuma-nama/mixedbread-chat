import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-form";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign up" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  // Already signed in: nothing to do here.
  const session = await getSession();
  if (session && !session.user.isAnonymous) redirect(next);

  return <AuthPage mode="register" next={next} />;
}
