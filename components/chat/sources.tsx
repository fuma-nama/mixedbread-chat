"use client";

import { cn } from "cn";
import { SliceGlyph } from "@/components/brand/slice";
import type { Citations } from "@/lib/messages";
import { originOf, SourcePreview } from "./citation";

/** The sources a message cited, numbered like its inline citations. */
export function Sources({
  citations,
  animate,
}: {
  citations: Citations;
  /** Slices land one after another, as when an answer just finished. */
  animate: boolean;
}) {
  if (citations.size === 0) return null;

  return (
    <ol aria-label="Sources" className="flex flex-wrap gap-1.5">
      {Array.from(citations.values(), ({ number, source }, index) => (
        <li
          key={source.label}
          className={animate ? "motion-safe:animate-rise" : undefined}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <SourcePreview
            source={source}
            number={number}
            side="bottom"
            align="start"
            className="group/chip flex h-7 max-w-60 cursor-pointer items-center gap-1.5 rounded-lg bg-card pr-2 pl-1.5 text-[12.5px] text-foreground/75 shadow-raised ring-1 ring-soft outline-offset-1 outline-ring transition-[color,box-shadow,background-color] duration-150 hover:text-foreground hover:ring-berry/35 focus-visible:outline-2 data-popup-open:ring-berry/45 data-[lit=true]:text-foreground data-[lit=true]:ring-berry/45"
          >
            <SliceGlyph
              className={cn(
                "size-3.5 text-berry",
                animate && "motion-safe:animate-settle",
              )}
              style={{ animationDelay: `${150 + number * 60}ms` }}
            />
            <span className="truncate">{originOf(source)}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
              {number}
            </span>
          </SourcePreview>
        </li>
      ))}
    </ol>
  );
}
