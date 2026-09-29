"use client";

import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";
import { createContext, use, useRef, useState } from "react";
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

/** The labels of the sources being pointed at, one or a whole file's. */
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
 * On touch screens, which have no hover, a tap shows the preview, and the
 * preview opens the source.
 */
export function SourcePreview({
  source,
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
  /** Every label it stands for, when searches found its source more than once. */
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
    if (!labels) return current?.has(source.label);
    for (const label of labels) if (current?.has(label)) return true;
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
          <SourceCard source={source} onView={view} />
        </HoverCardContent>
      </HoverCard>
      {organization && source.type === "file" && (
        <PageView
          source={source}
          organization={organization}
          open={viewing}
          onOpenChange={setViewing}
          finalFocus={trigger}
        />
      )}
    </>
  );
}

/** Where the source is from, its title and the passage read there; the whole card opens it, if it opens. */
function SourceCard({
  source,
  onView,
}: {
  source: Source;
  onView?: () => void;
}) {
  const quote = source.excerpt && plain(source.excerpt);
  const title = sourceTitle(source);
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="truncate font-mono">{originOf(source)}</span>
        {(source.type === "url" || onView) && (
          <ArrowUpRightIcon className="ml-auto size-3.5 shrink-0" />
        )}
      </span>
      <span className="line-clamp-3 text-[13.5px] leading-snug font-medium text-pretty text-foreground">
        {title}
      </span>
      {quote && (
        <span className="line-clamp-6 text-[12.5px] leading-relaxed wrap-break-word whitespace-pre-line text-muted-foreground">
          {quote}
        </span>
      )}
    </>
  );
  const card = "flex w-full flex-col gap-1.5 rounded-xl p-3.5 text-left";
  const action =
    "cursor-pointer outline-offset-[-2px] outline-ring transition-colors duration-150 hover:bg-soft focus-visible:outline-2";

  if (source.type === "url") {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        aria-label={title}
        className={cn(card, action)}
      >
        {body}
      </a>
    );
  }
  if (onView) {
    return (
      <button
        type="button"
        aria-label={`View page: ${title}`}
        aria-haspopup="dialog"
        onClick={onView}
        className={cn(card, action)}
      >
        {body}
      </button>
    );
  }
  return <div className={card}>{body}</div>;
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
