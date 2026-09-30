"use client";

import { memo } from "react";
import { Proofing } from "@/components/brand/bakery";
import { Activity, formatSeconds, LiveLine, useDuration } from "./activity";
import { LazyMarkdown } from "./lazy-markdown";

/** Memoized, so finished thoughts sit still while the answer streams. */
export const Reasoning = memo(function Reasoning({
  text,
  live,
  deferred,
}: {
  text: string;
  live: boolean;
  /** Arrived after the page loaded, see `LazyMarkdown`. */
  deferred: boolean;
}) {
  const seconds = useDuration(live);
  if (!text && !live) return null;

  return (
    <Activity
      indicator={<Proofing live={live} />}
      label={
        live ? (
          <span className="text-shimmer motion-safe:animate-shimmer">
            Thinking
          </span>
        ) : seconds !== undefined && seconds >= 1 ? (
          `Thought for ${formatSeconds(seconds)}`
        ) : (
          "Thought"
        )
      }
      status={live && <LiveLine text={latestThought(text)} />}
    >
      <LazyMarkdown
        deferred={deferred}
        isAnimating={live}
        className="text-[13px]/relaxed text-muted-foreground"
      >
        {text}
      </LazyMarkdown>
    </Activity>
  );
});

/** The newest finished thought: a bold heading if the model writes them, else a sentence. */
function latestThought(text: string): string | undefined {
  let heading: string | undefined;
  for (const [, title] of text.matchAll(/\*\*(.+?)\*\*/g)) heading = title;
  if (heading) return heading;

  const trimmed = text.trim();
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  // The last sentence may still be arriving; show the one before it.
  return sentences.at(/[.!?]$/.test(trimmed) ? -1 : -2)?.replace(/\s+/g, " ");
}
