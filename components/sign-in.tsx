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

export function SignIn({
  next,
  error,
  configured,
}: {
  next: string;
  error?: string;
  /** The host registered an OAuth client, see the README. */
  configured: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");
  const pending = status === "pending";
  const message =
    status === "failed"
      ? "Couldn’t reach Mixedbread. Try again."
      : error === "access_denied"
        ? "Sign-in was cancelled. Try again when you’re ready."
        : error && "Sign-in didn’t finish. Try again.";

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
      <p className="mt-3 text-[14px] text-pretty text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:120ms]">
        Ask questions across your Mixedbread stores and the web, with every
        answer cited.
      </p>

      {configured ? (
        <div className="mt-8 flex w-full flex-col items-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:180ms]">
          <Button
            size="lg"
            className="w-full disabled:opacity-100"
            disabled={pending}
            onClick={() => void signIn()}
          >
            <IconSwap
              swapped={pending}
              from={<Logo />}
              to={<Spinner aria-hidden="true" />}
            />
            <span
              key={String(pending)}
              className={pending ? "motion-safe:animate-swap-in" : undefined}
            >
              {pending ? "Opening Mixedbread…" : "Continue with Mixedbread"}
            </span>
          </Button>
          <p className="text-[12.5px] leading-relaxed text-pretty text-muted-foreground">
            Mixedbread asks which organization to connect. Bread Chat searches
            its stores with your access, and you can add more later.
          </p>
        </div>
      ) : (
        <div className="mt-8 w-full rounded-xl bg-soft px-4 py-3.5 text-left text-[13px] leading-relaxed text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:180ms]">
          <p className="font-medium text-foreground/85">
            Sign-in isn’t set up yet
          </p>
          <p className="mt-1 text-pretty">
            This app has no Mixedbread OAuth client. Run{" "}
            <code className="font-mono text-foreground">
              pnpm mixedbread:register
            </code>{" "}
            and set{" "}
            <code className="font-mono text-foreground">MXBAI_CLIENT_ID</code>.
          </p>
        </div>
      )}

      {message && (
        <p
          role="alert"
          className="mt-4 flex w-full items-start gap-2.5 rounded-xl bg-destructive/6 px-3.5 py-2.5 text-left text-[13px] text-foreground/85 ring-1 ring-destructive/15 motion-safe:animate-rise motion-safe:[animation-duration:280ms]"
        >
          <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-destructive" />
          {message}
        </p>
      )}
    </>
  );
}
