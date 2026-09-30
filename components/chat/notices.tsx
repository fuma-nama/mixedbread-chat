"use client";

import { APICallError } from "ai";
import { ArrowRightIcon, CornerDownRightIcon } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { answersPerDay } from "@/lib/limits";

type Failure = "limit" | "session" | "network" | "other";

export function failureOf(error: Error): Failure {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return "limit";
    return error.statusCode === 401 ? "session" : "other";
  }
  return error.name === "TypeError" || !navigator.onLine ? "network" : "other";
}

/** The request never reached the chat: nothing was saved, so it can be undone. */
export function wasRejected(error: Error): boolean {
  return (
    APICallError.isInstance(error) &&
    [400, 401, 404, 429].includes(error.statusCode ?? 0)
  );
}

const notices: Record<Failure, [text: string, action?: string]> = {
  network: ["Connection lost. Check your network.", "Try again"],
  session: ["Your session ended.", "Reload"],
  limit: [
    `You’ve reached today’s limit of ${answersPerDay} answers. Try again later.`,
  ],
  other: ["Something went wrong.", "Try again"],
};

export function ErrorNotice({
  failure,
  onRetry,
}: {
  failure: Failure;
  onRetry: () => void;
}) {
  const [text, action] = notices[failure];

  return (
    <div
      role="alert"
      className="mt-8 flex items-center gap-3 rounded-xl bg-destructive/6 py-2 pr-2 pl-3.5 text-[13.5px] ring-1 ring-destructive/15 first:mt-0 motion-safe:animate-rise"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
      <p className="flex-1 text-foreground/85">{text}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            failure === "session" ? window.location.reload() : onRetry()
          }
        >
          {action}
        </Button>
      )}
    </div>
  );
}

/** A question saved without its answer, as when the tab closed mid-way. */
export function Unanswered({ onAnswer }: { onAnswer: () => void }) {
  return (
    <div className="mt-8 motion-safe:animate-fade">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 text-muted-foreground"
        onClick={onAnswer}
      >
        <CornerDownRightIcon />
        Answer
      </Button>
    </div>
  );
}

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
