"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { IconSwap } from "@/components/ui/icon-swap";
import { Spinner } from "@/components/ui/spinner";
import { useWindowEvent } from "@/hooks/use-window-event";
import { authClient } from "@/lib/auth-client";
import { PROVIDER_ID } from "@/lib/mixedbread/platform";
import { withNext } from "@/lib/safe-next";

/** The one way in: signing in with Mixedbread, which also picks an organization. */
export function SignIn({
  next,
  error,
  configured,
}: {
  next: string;
  /** The error Better Auth sent back from a failed sign-in. */
  error?: string;
  /** The host registered an OAuth client, see the README. */
  configured: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");
  const pending = status === "pending";
  const message =
    status === "failed"
      ? "Couldn’t reach Mixedbread."
      : error === "access_denied"
        ? "Sign-in cancelled."
        : error && "Sign-in didn’t finish.";

  // Back from Mixedbread through the back button, the page can return just
  // as it was left: pending, with nothing on its way.
  useWindowEvent("pageshow", (event) => {
    if (event.persisted) setStatus("idle");
  });

  async function signIn() {
    setStatus("pending");
    const result = await authClient.signIn
      .social({
        provider: PROVIDER_ID,
        callbackURL: next,
        // A failed attempt comes back here, still headed where it was going.
        errorCallbackURL: withNext("/login", next),
      })
      .catch(() => ({ error: true }));
    // On success the browser is already on its way to Mixedbread, so the
    // button stays pending until the page goes.
    if (result.error) setStatus("failed");
  }

  return (
    <>
      {/* Home would only lead back here, so only a shared chat gets a way back. */}
      {next !== "/" && (
        <Link
          href={next}
          aria-label="Back to the chat"
          className={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
            className: "absolute top-4 left-4 text-muted-foreground",
          })}
        >
          <ArrowLeftIcon />
        </Link>
      )}

      <h1 className="mt-6 text-[1.75rem] leading-[1.15] font-normal tracking-[-0.025em] text-balance motion-safe:animate-rise motion-safe:[animation-delay:60ms]">
        Sign in to Bread Chat
      </h1>

      {configured ? (
        <Button
          size="lg"
          className="mt-8 w-full disabled:opacity-100 motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
          disabled={pending}
          onClick={() => void signIn()}
        >
          <IconSwap
            swapped={pending}
            from={<Logo />}
            to={<Spinner aria-hidden="true" />}
          />
          Continue with Mixedbread
        </Button>
      ) : (
        <p className="mt-8 text-[13px] leading-relaxed text-pretty text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:120ms]">
          Sign-in isn’t set up. Run{" "}
          <code className="font-mono text-foreground">
            pnpm mixedbread:register
          </code>{" "}
          and set{" "}
          <code className="font-mono text-foreground">MXBAI_CLIENT_ID</code>.
        </p>
      )}

      {message && (
        <p
          role="alert"
          className="mt-4 text-[13px] text-destructive motion-safe:animate-fade"
        >
          {message}
        </p>
      )}
    </>
  );
}
