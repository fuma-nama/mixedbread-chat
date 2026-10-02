import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HalftoneMark } from "@/components/brand/halftone-mark";
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
  if (await getViewer()) redirect(next);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-80 flex-col items-center text-center">
        <div className="h-20 w-36">
          <HalftoneMark />
        </div>
        <SignIn
          next={next}
          error={typeof params.error === "string" ? params.error : undefined}
          configured={Boolean(clientId)}
        />
      </div>
    </main>
  );
}
