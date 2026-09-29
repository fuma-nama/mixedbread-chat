import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignIn } from "@/components/sign-in";
import { clientId } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // Already signed in: nothing to do here.
  if (await getViewer()) redirect(next);

  return (
    <SignIn
      next={next}
      error={typeof params.error === "string" ? params.error : undefined}
      configured={Boolean(clientId)}
    />
  );
}
