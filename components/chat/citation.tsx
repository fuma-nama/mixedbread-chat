"use client";

import { cn } from "cn";
import { ArrowUpRightIcon, ScanSearchIcon } from "lucide-react";
import {
  createContext,
  memo,
  use,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { SliceGlyph } from "@/components/brand/slice";
import {
  createHoverCardHandle,
  HoverCard,
  HoverCardContent,
  type HoverCardHandle,
  HoverCardTrigger,
  HoverCardViewport,
} from "@/components/ui/hover-card";
import { useCoarsePointer } from "@/hooks/use-media";
import { createStore, type Store, useStore } from "@/hooks/use-store";
import { type Source, sourceTitle } from "@/lib/mixedbread/citations";
import type { Organization } from "@/lib/sources";
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

type FileSource = Extract<Source, { type: "file" }>;

/** What the card shows, and by which trigger. */
interface Preview {
  id: string;
  source: Source;
  number?: number;
  /** Whose page it is, for a page its reader can open. */
  organization?: Organization;
  side: "top" | "bottom";
  align: "start" | "center";
}

interface Page {
  source: FileSource;
  organization: Organization;
  /** Where focus goes back to once it closes. */
  trigger: React.RefObject<HTMLElement | null>;
  open: boolean;
}

interface Cards {
  handle: HoverCardHandle<Preview>;
  page: Store<Page | undefined>;
}

const CardsContext = createContext<Cards | null>(null);

/**
 * One card for every source in a chat: moving to another source, it glides
 * there instead of one card fading out as the next fades in. And one view
 * for the pages they open.
 */
export function SourceCards({ children }: { children: React.ReactNode }) {
  const [cards] = useState<Cards>(() => ({
    handle: createHoverCardHandle<Preview>(),
    page: createStore<Page | undefined>(undefined),
  }));

  return (
    <CardsContext value={cards}>
      {children}
      <Card cards={cards} />
      <PageViews cards={cards} />
    </CardsContext>
  );
}

function view(cards: Cards, page: Omit<Page, "open">) {
  cards.handle.close();
  cards.page.set({ ...page, open: true });
}

const Card = memo(function Card({ cards }: { cards: Cards }) {
  return (
    <HoverCard handle={cards.handle}>
      {({ payload }) => <CardContent preview={payload} cards={cards} />}
    </HoverCard>
  );
});

/**
 * The card is only a preview: pointers pass through it to what lies under,
 * and a click on the trigger opens the source. Only a finger, which has no
 * hover, uses the links on it.
 */
function CardContent({ preview, cards }: { preview?: Preview; cards: Cards }) {
  const anchor = useMemo(() => preview && around(preview.id), [preview]);
  const source = preview?.source;
  const organization = preview?.organization;

  return (
    <HoverCardContent
      side={preview?.side}
      align={preview?.align}
      anchor={anchor}
      className="pointer-events-none w-80 p-0 pointer-coarse:[&_:is(a,button)]:pointer-events-auto"
    >
      <HoverCardViewport>
        {preview && source && (
          <SourceCard
            source={source}
            number={preview.number}
            onView={
              organization && source.type === "file"
                ? () =>
                    view(cards, {
                      source,
                      organization,
                      trigger: { current: document.getElementById(preview.id) },
                    })
                : undefined
            }
          />
        )}
      </HoverCardViewport>
    </HoverCardContent>
  );
}

// Where an inline citation sits; the lists of sources mark themselves.
const BLOCKS = "p, li, tr, h1, h2, h3, h4, h5, h6, blockquote";

/**
 * Where the card goes: along the trigger, above or below the group it sits
 * in (its list, row of chips or paragraph), so the triggers next to it stay
 * in view. A group too tall to clear leaves just the trigger.
 */
function around(id: string) {
  const trigger = document.getElementById(id);
  if (!trigger) return undefined;
  const group =
    trigger.closest("[data-card-group]") ?? trigger.closest(BLOCKS) ?? trigger;
  return {
    contextElement: trigger,
    getBoundingClientRect() {
      const own = trigger.getBoundingClientRect();
      const all = group.getBoundingClientRect();
      if (all.height > innerHeight / 2) return own;
      return new DOMRect(own.x, all.y, own.width, all.height);
    },
  };
}

const PageViews = memo(function PageViews({ cards }: { cards: Cards }) {
  const page = useStore(cards.page, (page) => page);
  if (!page) return null;
  return (
    <PageView
      key={page.source.label}
      source={page.source}
      organization={page.organization}
      origin={originOf(page.source)}
      open={page.open}
      onOpenChange={(open) => cards.page.set({ ...page, open })}
      finalFocus={page.trigger}
    />
  );
});

/**
 * Anything that previews a source in the chat's card. With a mouse it
 * previews on hover and opens the source on click: its site, or the page of
 * a file shown as one. On touch screens, which have no hover, a tap shows
 * the card, and a link on it opens the source.
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
  const cards = use(CardsContext);
  if (!cards) throw new Error("SourcePreview needs <SourceCards>");
  const id = useId();
  const trigger = useRef<HTMLAnchorElement>(null);
  const coarse = useCoarsePointer();
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
  const preview = useMemo(
    () => ({ id, source, number, organization, side, align }),
    [id, source, number, organization, side, align],
  );
  const open =
    organization && source.type === "file"
      ? () => view(cards, { source, organization, trigger })
      : undefined;

  return (
    <HoverCardTrigger
      handle={cards.handle}
      payload={preview}
      id={id}
      ref={trigger}
      {...(source.type === "url" && !coarse
        ? { href: source.url, target: "_blank", rel: "noreferrer" }
        : { render: <button type="button" /> })}
      onPointerEnter={light}
      onPointerLeave={() => highlight.set(rest)}
      onFocus={light}
      onBlur={() => highlight.set(undefined)}
      onClick={coarse ? () => cards.handle.open(id) : open}
      aria-haspopup={!coarse && organization ? "dialog" : undefined}
      data-lit={lit}
      data-citation={citation}
      aria-label={label}
      className={className}
    >
      {children}
    </HoverCardTrigger>
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
