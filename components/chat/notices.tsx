"use client";

import { APICallError } from "ai";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

type Failure =
  | { kind: "limit" }
  | { kind: "session" }
  | { kind: "network" }
  | { kind: "other" };

/** What went wrong with a request, in the terms the reader can act on. */
export function failureOf(error: Error): Failure {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return { kind: "limit" };
    if (error.statusCode === 401) return { kind: "session" };
    return { kind: "other" };
  }
  if (error.name === "TypeError" || !navigator.onLine)
    return { kind: "network" };
  return { kind: "other" };
}

/** The request never reached the chat: nothing was saved, so it can be undone. */
export function wasRejected(error: Error): boolean {
  return (
    APICallError.isInstance(error) &&
    error.statusCode !== undefined &&
    [400, 401, 404, 429].includes(error.statusCode)
  );
}

/** An answer that did not come, in place of the answer. */
export function ErrorNotice({
  failure,
  onRetry,
}: {
  failure: Failure;
  onRetry: () => void;
}) {
  const [text, action] =
    failure.kind === "network"
      ? ["Connection lost.", "Try again"]
      : failure.kind === "session"
        ? ["Your session ended.", "Reload"]
        : failure.kind === "limit"
          ? ["Daily limit reached. Try again later.", undefined]
          : ["Something went wrong.", "Try again"];

  return (
    <div
      role="alert"
      className="mt-8 flex items-center gap-3 rounded-xl bg-destructive/8 py-2 pr-2 pl-3.5 text-[13.5px] first:mt-0 motion-safe:animate-rise"
    >
      <p className="flex-1 text-foreground/85">{text}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            failure.kind === "session" ? window.location.reload() : onRetry()
          }
        >
          {action}
        </Button>
      )}
    </div>
  );
}

/** Takes the composer's place under someone else's shared chat. */
export function SharedNotice() {
  return (
    <Link
      href="/"
      className={buttonVariants({
        size: "lg",
        className: "mx-auto rounded-full px-5 motion-safe:animate-rise",
      })}
    >
      Start your own chat
      <ArrowRightIcon />
    </Link>
  );
}
