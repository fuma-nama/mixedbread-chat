"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { createContext, use, useState } from "react";
import { SliceGlyph } from "@/components/brand/slice";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useCoarsePointer } from "@/hooks/use-media";
import { createStore, useStore } from "@/hooks/use-store";
import {
  type Source,
  sourceOrigin,
  sourceTitle,
} from "@/lib/mixedbread/citations";

/** The label of the source being pointed at, in citations or in the list. */
const HighlightContext = createContext(
  createStore<string | undefined>(undefined),
);

/** Pairs a message's inline citations with its sources: hovering one lights up the other. */
export function CitationHighlight({ children }: { children: React.ReactNode }) {
  const [highlight] = useState(() =>
    createStore<string | undefined>(undefined),
  );
  return <HighlightContext value={highlight}>{children}</HighlightContext>;
}

/** An inline citation: the source's number, with the source on hover. */
export function Citation({
  number,
  source,
}: {
  number: number;
  source: Source;
}) {
  return (
    <SourcePreview
      source={source}
      number={number}
      data-citation={number}
      aria-label={`Source ${number}: ${sourceTitle(source)}, ${sourceOrigin(source)}`}
      className="relative -top-[0.1em] mx-[0.2em] inline-flex h-[1.2rem] min-w-[1.2rem] cursor-pointer items-center justify-center rounded-[0.35rem] bg-soft px-[0.3rem] align-middle font-mono text-[0.69rem] font-medium text-muted-foreground tabular-nums no-underline outline-offset-1 outline-ring transition-[background-color,color] duration-150 ease-smooth hover:bg-berry/15 hover:text-berry focus-visible:outline-2 data-popup-open:bg-berry/15 data-popup-open:text-berry data-[lit=true]:bg-berry/15 data-[lit=true]:text-berry"
    >
      {number}
    </SourcePreview>
  );
}

/**
 * Anything that previews a source. With a mouse it previews on hover and
 * opens the page on click; on touch screens, which have no hover, a tap
 * shows the preview and the link inside it opens the page.
 */
export function SourcePreview({
  source,
  number,
  side = "top",
  align = "center",
  className,
  children,
  "aria-label": label,
  "data-citation": citation,
}: {
  source: Source;
  number: number;
  side?: "top" | "bottom";
  align?: "start" | "center";
  className: string;
  children: React.ReactNode;
  "aria-label"?: string;
  /** Marks an inline citation, so copies of the text can leave it out. */
  "data-citation"?: number;
}) {
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState(false);
  const highlight = use(HighlightContext);
  const lit = useStore(highlight, (current) => current === source.label);
  const light = () => highlight.set(source.label);
  const dim = () => highlight.set(undefined);

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        {...(source.type === "url" && !coarse
          ? { href: source.url, target: "_blank", rel: "noreferrer" }
          : { render: <button type="button" /> })}
        onPointerEnter={light}
        onPointerLeave={dim}
        onFocus={light}
        onBlur={dim}
        onClick={coarse ? () => setOpen(true) : undefined}
        data-lit={lit}
        data-citation={citation}
        aria-label={label}
        className={className}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent side={side} align={align} className="w-80 p-0">
        <SourceCard source={source} number={number} />
      </HoverCardContent>
    </HoverCard>
  );
}

function SourceCard({ source, number }: { source: Source; number: number }) {
  return (
    <div className="flex flex-col gap-2 p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <SliceGlyph className="size-3 text-berry" />
        <span className="truncate font-mono">{sourceOrigin(source)}</span>
        <span className="ml-auto font-mono tabular-nums">{number}</span>
      </div>
      <p className="line-clamp-3 text-[13.5px] leading-snug font-medium text-pretty text-foreground">
        {sourceTitle(source)}
      </p>
      {source.type === "url" && (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 truncate text-xs text-muted-foreground outline-offset-2 outline-ring transition-colors hover:text-foreground focus-visible:outline-2"
        >
          <ArrowUpRightIcon className="size-3 shrink-0" />
          <span className="truncate">
            {source.url.replace(/^https?:\/\//, "")}
          </span>
        </a>
      )}
    </div>
  );
}
