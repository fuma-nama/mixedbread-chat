"use client";

import { Proofing } from "@/components/brand/bakery";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  ActivityPanel,
  ActivityTrigger,
  formatSeconds,
  LiveLine,
  useDuration,
} from "./activity";
import { LazyMarkdown } from "./lazy-markdown";

/** The model's reasoning: a live line while it thinks, folded away after. */
export function Reasoning({
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
    <Collapsible data-slot="activity">
      <ActivityTrigger
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
      />
      <LiveLine text={live ? latestThought(text) : undefined} />
      <CollapsibleContent hiddenUntilFound>
        <ActivityPanel>
          <LazyMarkdown
            deferred={deferred}
            isAnimating={live}
            className="text-[13px]/relaxed text-muted-foreground"
          >
            {text}
          </LazyMarkdown>
        </ActivityPanel>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
