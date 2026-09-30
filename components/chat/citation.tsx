"use client";

import { PreviewCard } from "@base-ui/react/preview-card";
import { cn } from "cn";
import { ArrowUpRightIcon, ScanSearchIcon } from "lucide-react";
import { createContext, memo, use, useId, useState } from "react";
import { SliceGlyph } from "@/components/brand/slice";
import { createDialogHandle, type DialogHandle } from "@/components/ui/dialog";
import { useCoarsePointer } from "@/hooks/use-media";
import { createStore, useStore } from "@/hooks/use-store";
import { originOf, type Source, sourceTitle } from "@/lib/mixedbread/citations";
import { PageView, type ShownPage } from "./page-view";
import { useOrganizations } from "./sources-provider";

type Lit = ReadonlySet<string> | undefined;

/** The labels of the sources being pointed at: one, or all of a file's. */
const HighlightContext = createContext(createStore<Lit>(undefined));

export function useHighlight() {
  return use(HighlightContext);
}

/** Pairs a message's inline citations with its sources: hovering one lights up the other. */
export function CitationHighlight({ children }: { children: React.ReactNode }) {
  const [highlight] = useState(() => createStore<Lit>(undefined));
  return <HighlightContext value={highlight}>{children}</HighlightContext>;
}

export const badge =
  "cursor-pointer items-center justify-center rounded-[0.35rem] bg-soft font-mono font-medium text-muted-foreground tabular-nums no-underline outline-offset-1 outline-ring transition-[background-color,color] duration-150 ease-smooth hover:bg-berry/15 hover:text-berry focus-visible:outline-2 data-popup-open:bg-berry/15 data-popup-open:text-berry data-[lit=true]:bg-berry/15 data-[lit=true]:text-berry";

/** Memoized: streamdown makes these, and settled ones sit still while the answer streams. */
export const Citation = memo(function Citation({
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
});

interface Preview {
  source: Source;
  number?: number;
  /** Opens its page, for a page its reader can open. */
  open?: () => void;
  side: "top" | "bottom";
  align: "start" | "center";
}

interface Cards {
  card: PreviewCard.Handle<Preview>;
  page: DialogHandle<ShownPage>;
}

const CardsContext = createContext<Cards | null>(null);

// Pointers pass through the card, and a click on the trigger opens the source;
// only a finger, which has no hover, uses the links on it.
export function SourceCards({ children }: { children: React.ReactNode }) {
  const [cards] = useState<Cards>(() => ({
    card: PreviewCard.createHandle(),
    page: createDialogHandle(),
  }));

  return (
    <CardsContext value={cards}>
      {children}
      <PreviewCard.Root handle={cards.card}>
        {({ payload }) => (
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              align={payload?.align}
              side={payload?.side}
              sideOffset={8}
              className="pointer-events-none isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,right,bottom,left] duration-240 ease-smooth data-instant:transition-none motion-reduce:transition-none"
            >
              <PreviewCard.Popup className="pointer-events-none relative h-(--popup-height,auto) w-80 origin-(--transform-origin) rounded-xl bg-popover p-0 text-sm text-popover-foreground shadow-float transition-[opacity,scale,height] duration-[150ms,150ms,240ms] ease-smooth outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none pointer-coarse:[&_:is(a,button)]:pointer-events-auto">
                <PreviewCard.Viewport className="relative size-full overflow-clip [&>*]:transition-[translate,opacity] [&>*]:duration-200 [&>*]:ease-smooth motion-reduce:[&>*]:transition-none [&>[data-current][data-starting-style]]:opacity-0 data-[activation-direction~='down']:[&>[data-current][data-starting-style]]:translate-y-2 data-[activation-direction~='left']:[&>[data-current][data-starting-style]]:-translate-x-3 data-[activation-direction~='right']:[&>[data-current][data-starting-style]]:translate-x-3 data-[activation-direction~='up']:[&>[data-current][data-starting-style]]:-translate-y-2 [&>[data-previous]]:w-(--popup-width) [&>[data-previous][data-ending-style]]:opacity-0 data-[activation-direction~='down']:[&>[data-previous][data-ending-style]]:-translate-y-2 data-[activation-direction~='left']:[&>[data-previous][data-ending-style]]:translate-x-3 data-[activation-direction~='right']:[&>[data-previous][data-ending-style]]:-translate-x-3 data-[activation-direction~='up']:[&>[data-previous][data-ending-style]]:translate-y-2">
                  {payload && <SourceCard {...payload} />}
                </PreviewCard.Viewport>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        )}
      </PreviewCard.Root>
      <PageView handle={cards.page} />
    </CardsContext>
  );
}

/**
 * Anything that previews a source in the chat's card. With a mouse it
 * previews on hover and opens the source on click: its site, or the page of
 * a file shown as one. On touch screens a tap shows the card instead.
 */
export function SourcePreview({
  source,
  number,
  labels,
  rest,
  side = "top",
  align = "center",
  ...props
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
  const open =
    organization && source.type === "file"
      ? () => {
          cards.card.close();
          const trigger = document.getElementById(id);
          cards.page.openWithPayload({ source, organization, trigger });
        }
      : undefined;

  return (
    <PreviewCard.Trigger
      handle={cards.card}
      delay={250}
      closeDelay={150}
      payload={{ source, number, open, side, align }}
      id={id}
      {...(source.type === "url" && !coarse
        ? { href: source.url, target: "_blank", rel: "noreferrer" }
        : { render: <button type="button" /> })}
      onPointerEnter={light}
      onPointerLeave={() => highlight.set(rest)}
      onFocus={light}
      onBlur={() => highlight.set(undefined)}
      onClick={coarse ? () => cards.card.open(id) : open}
      aria-haspopup={!coarse && open ? "dialog" : undefined}
      data-lit={lit}
      {...props}
    />
  );
}

function SourceCard({ source, number, open }: Preview) {
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
      {open && (
        <button
          type="button"
          onClick={open}
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
