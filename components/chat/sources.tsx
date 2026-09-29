"use client";

import { cn } from "cn";
import { useMemo } from "react";
import { SliceGlyph } from "@/components/brand/slice";
import type { Citations } from "@/lib/messages";
import { sourceTitle } from "@/lib/mixedbread/citations";
import { badge, originOf, SourcePreview, useHighlight } from "./citation";

type Cited = Citations extends Map<string, infer Entry> ? Entry : never;

/**
 * The sources a message cited: a chip for each store or site, with the
 * numbers of its inline citations, each previewing its own source. Pointing
 * at a chip lights up all of them.
 */
export function Sources({
  citations,
  animate,
}: {
  citations: Citations;
  /** Chips rise and slices land one after another, as when an answer just finished. */
  animate: boolean;
}) {
  const highlight = useHighlight();
  const origins = useMemo(() => {
    const origins = new Map<string, { labels: Set<string>; cited: Cited[] }>();
    for (const cited of citations.values()) {
      const origin = originOf(cited.source);
      let entry = origins.get(origin);
      if (!entry) {
        entry = { labels: new Set(), cited: [] };
        origins.set(origin, entry);
      }
      entry.labels.add(cited.source.label);
      entry.cited.push(cited);
    }
    return origins;
  }, [citations]);
  if (origins.size === 0) return null;

  return (
    <ol aria-label="Sources" className="flex flex-wrap gap-1.5">
      {Array.from(origins, ([origin, { labels, cited }], index) => (
        <li
          key={origin}
          onPointerEnter={() => highlight.set(labels)}
          onPointerLeave={() => highlight.set(undefined)}
          style={{ animationDelay: `${index * 50}ms` }}
          className={cn(
            "relative flex min-h-7 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-card py-1 pr-1 pl-1.5 text-[12.5px] text-foreground/75 shadow-raised ring-1 ring-soft transition-[color,box-shadow] duration-150 hover:text-foreground hover:ring-berry/35 has-data-[lit=true]:text-foreground has-data-[lit=true]:ring-berry/45",
            animate && "motion-safe:animate-rise",
          )}
        >
          <SliceGlyph
            className={cn(
              "size-3.5 text-berry",
              animate && "motion-safe:animate-settle",
            )}
            style={{ animationDelay: `${150 + index * 60}ms` }}
          />
          <span className="max-w-44 truncate">{origin}</span>
          {cited.map(({ number, source }) => (
            <SourcePreview
              key={source.label}
              source={source}
              rest={labels}
              side="bottom"
              align="start"
              aria-label={`Source ${number}: ${sourceTitle(source)}, ${origin}`}
              className={cn(
                badge,
                "flex h-5 min-w-5 shrink-0 px-1 text-[10.5px]",
                // Alone, it takes the whole chip.
                cited.length === 1 && "after:absolute after:inset-0",
              )}
            >
              {number}
            </SourcePreview>
          ))}
        </li>
      ))}
    </ol>
  );
}
