"use client";

import { cn } from "cn";
import { ArrowUpRightIcon, ScanSearchIcon } from "lucide-react";
import { createContext, use, useRef, useState } from "react";
import { SliceGlyph } from "@/components/brand/slice";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useCoarsePointer } from "@/hooks/use-media";
import { createStore, type Store, useStore } from "@/hooks/use-store";
import { type Source, sourceTitle } from "@/lib/mixedbread/citations";
import { PageView } from "./page-view";
import { useOrganizations } from "./sources-provider";

/** Where a source is from: the store it was found in, or its site. */
export function originOf(source: Source): string {
  if (source.type === "file") return source.storeName ?? "Your files";
  return URL.parse(source.url)?.hostname.replace(/^www\./, "") ?? source.url;
}

type Lit = ReadonlySet<string> | undefined;

/** The labels of the sources being pointed at: one, or all of a file's. */
const HighlightContext = createContext(createStore<Lit>(undefined));

export function useHighlight(): Store<Lit> {
  return use(HighlightContext);
}

/** Pairs a message's inline citations with its sources: hovering one lights up the other. */
export function CitationHighlight({ children }: { children: React.ReactNode }) {
  const [highlight] = useState(() => createStore<Lit>(undefined));
  return <HighlightContext value={highlight}>{children}</HighlightContext>;
}

/** A source's number, lit berry while it is pointed at here or elsewhere. */
export const badge =
  "cursor-pointer items-center justify-center rounded-[0.35rem] bg-soft font-mono font-medium text-muted-foreground tabular-nums no-underline outline-offset-1 outline-ring transition-[background-color,color] duration-150 ease-smooth hover:bg-berry/15 hover:text-berry focus-visible:outline-2 data-popup-open:bg-berry/15 data-popup-open:text-berry data-[lit=true]:bg-berry/15 data-[lit=true]:text-berry";

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
      aria-label={`Source ${number}: ${sourceTitle(source)}, ${originOf(source)}`}
      className={cn(
        badge,
        "relative -top-[0.1em] mx-[0.2em] inline-flex h-[1.2rem] min-w-[1.2rem] px-[0.3rem] align-middle text-[0.69rem]",
      )}
    >
      {number}
    </SourcePreview>
  );
}

/**
 * Anything that previews a source. With a mouse it previews on hover and
 * opens the source on click: its site, or the page of a file shown as one.
 * On touch screens, which have no hover, a tap shows the preview, and a
 * link inside opens the source.
 */
export function SourcePreview({
  source,
  number,
  labels,
  rest,
  side = "top",
  align = "center",
  className,
  children,
  "aria-label": label,
  "data-citation": citation,
}: {
  source: Source;
  /** As the answer numbers it; the search trace lists sources it may not cite. */
  number?: number;
  /** Every label it stands for, when several searches found it. */
  labels?: ReadonlySet<string>;
  /** What stays lit as the pointer leaves it for the row it sits in. */
  rest?: ReadonlySet<string>;
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
  const [viewing, setViewing] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const highlight = useHighlight();
  const lit = useStore(highlight, (current) => {
    if (!current || !labels) return current?.has(source.label) ?? false;
    for (const label of labels) if (current.has(label)) return true;
    return false;
  });
  const light = () => highlight.set(labels ?? new Set([source.label]));
  // A page shows to those connected to its organization, with their access.
  const organizations = useOrganizations();
  const organization =
    source.type === "file" && source.image
      ? organizations.find((entry) => entry.id === source.organizationId)
      : undefined;
  const view =
    organization &&
    (() => {
      setOpen(false);
      setViewing(true);
    });

  return (
    <>
      <HoverCard open={open} onOpenChange={setOpen}>
        <HoverCardTrigger
          ref={trigger}
          {...(source.type === "url" && !coarse
            ? { href: source.url, target: "_blank", rel: "noreferrer" }
            : { render: <button type="button" /> })}
          onPointerEnter={light}
          onPointerLeave={() => highlight.set(rest)}
          onFocus={light}
          onBlur={() => highlight.set(undefined)}
          onClick={coarse ? () => setOpen(true) : view}
          aria-haspopup={!coarse && view ? "dialog" : undefined}
          data-lit={lit}
          data-citation={citation}
          aria-label={label}
          className={className}
        >
          {children}
        </HoverCardTrigger>
        <HoverCardContent side={side} align={align} className="w-80 p-0">
          <SourceCard source={source} number={number} onView={view} />
        </HoverCardContent>
      </HoverCard>
      {organization && source.type === "file" && (
        <PageView
          source={source}
          organization={organization}
          origin={originOf(source)}
          open={viewing}
          onOpenChange={setViewing}
          finalFocus={trigger}
        />
      )}
    </>
  );
}

function SourceCard({
  source,
  number,
  onView,
}: {
  source: Source;
  number?: number;
  onView?: () => void;
}) {
  const quote = source.excerpt && plain(source.excerpt);

  return (
    <div className="flex flex-col gap-2 p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <SliceGlyph className="size-3 text-berry" />
        <span className="truncate font-mono">{originOf(source)}</span>
        <span className="ml-auto font-mono tabular-nums">{number}</span>
      </div>
      <p className="line-clamp-3 text-[13.5px] leading-snug font-medium text-pretty text-foreground">
        {sourceTitle(source)}
      </p>
      {quote && (
        <blockquote className="line-clamp-6 border-l-2 border-honey pl-2.5 text-[12.5px] leading-relaxed wrap-break-word whitespace-pre-line text-muted-foreground">
          {quote}
        </blockquote>
      )}
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
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="flex cursor-pointer items-center gap-1 self-start text-xs text-muted-foreground outline-offset-2 outline-ring transition-colors hover:text-foreground focus-visible:outline-2"
        >
          <ScanSearchIcon className="size-3 shrink-0" />
          View page
        </button>
      )}
    </div>
  );
}

// Images, and the marks around links, bold, headings, fences and code.
const MARKS =
  /!\[[^\]]*\]\([^)]*\)|\[([^\]]*)\]\([^)]*\)|\*\*(?=\S)([^*]*\S)\*\*|^#{1,6}\s+|^```.*|`/g;

/** A passage as plain text, one line per block. */
function plain(text: string): string {
  let lines = "";
  for (const line of text.split("\n")) {
    const words = line
      .replace(MARKS, (_, link?: string, bold?: string) => link ?? bold ?? "")
      .trim();
    if (words) lines += lines ? `\n${words}` : words;
  }
  return lines;
}
