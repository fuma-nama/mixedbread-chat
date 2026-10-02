"use client";

import { PreviewCard } from "@base-ui/react/preview-card";
import { cn } from "cn";
import { ArrowUpRightIcon, ScanSearchIcon } from "lucide-react";
import { memo, useId, useRef, useState } from "react";
import useSWR from "swr";
import { openPage, type PageResult } from "@/app/(chat)/actions";
import { SliceGlyph } from "@/components/brand/slice";
import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useCoarsePointer } from "@/hooks/use-media";
import { originOf, type Source, sourceTitle } from "@/lib/mixedbread/citations";
import type { Organization } from "@/lib/sources";
import { useConnect, useOrganizations } from "./picks";

interface Preview {
  source: Source;
  number?: number;
  open?: () => void;
  side: "top" | "bottom";
  align: "start" | "center";
}

const card = PreviewCard.createHandle<Preview>();
const page = createDialogHandle<ShownPage>();

export function light(from: Element, labels?: ReadonlySet<string>) {
  const message = from.closest("[data-message-id]");
  for (const element of message?.querySelectorAll<HTMLElement>(
    "[data-labels]",
  ) ?? []) {
    const own = (element.dataset.labels ?? "").split(" ");
    element.toggleAttribute(
      "data-lit",
      labels !== undefined && own.some((label) => labels.has(label)),
    );
  }
}

export const badge =
  "cursor-pointer items-center justify-center rounded-[0.35rem] bg-soft font-mono font-medium text-muted-foreground tabular-nums no-underline outline-offset-1 outline-ring transition-[background-color,color] duration-150 ease-smooth hover:bg-berry/15 hover:text-berry focus-visible:outline-2 data-popup-open:bg-berry/15 data-popup-open:text-berry data-lit:bg-berry/15 data-lit:text-berry";

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

// Pointers pass through the card, as clicking the trigger opens the source; touch uses its links.
export function SourceCards() {
  return (
    <>
      <PreviewCard.Root handle={card}>
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
      <Dialog handle={page}>
        {({ payload }) => payload && <PageView {...payload} />}
      </Dialog>
    </>
  );
}

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
  /** As the answer numbers it; the search trace lists uncited ones too. */
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
  const id = useId();
  const coarse = useCoarsePointer();
  const own = labels ?? new Set([source.label]);
  // A page shows to those connected to its organization, with their access.
  const organizations = useOrganizations();
  const organization =
    source.type === "file" && source.image
      ? organizations.find((entry) => entry.id === source.organizationId)
      : undefined;
  const open =
    organization && source.type === "file"
      ? () => {
          card.close();
          const trigger = document.getElementById(id);
          page.openWithPayload({ source, organization, trigger });
        }
      : undefined;

  return (
    <PreviewCard.Trigger
      handle={card}
      delay={250}
      closeDelay={150}
      payload={{ source, number, open, side, align }}
      id={id}
      {...(source.type === "url" && !coarse
        ? { href: source.url, target: "_blank", rel: "noreferrer" }
        : { render: <button type="button" /> })}
      onPointerEnter={(event) => light(event.currentTarget, own)}
      onPointerLeave={(event) => light(event.currentTarget, rest)}
      onFocus={(event) => light(event.currentTarget, own)}
      onBlur={(event) => light(event.currentTarget)}
      onClick={coarse ? () => card.open(id) : open}
      aria-haspopup={!coarse && open ? "dialog" : undefined}
      data-labels={Array.from(own).join(" ")}
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

interface ShownPage {
  source: Extract<Source, { type: "file" }>;
  organization: Organization;
  trigger: HTMLElement | null;
}

// The loading stand-in takes a tall page's height, so the dialog holds still.
const frame = "h-[min(60vh,40rem)] rounded-lg bg-soft";

const notice =
  "flex flex-col items-center justify-center gap-3 rounded-lg bg-soft px-4 py-12 text-center text-[13px] text-pretty text-muted-foreground";

function PageView({ source, organization, trigger }: ShownPage) {
  // Its links expire within the hour, so a page opened again soon reuses them.
  const { data: result, mutate } = useSWR(
    {
      organizationId: organization.id,
      storeId: source.storeId,
      chunkId: source.chunkId,
      claim: source.claim,
    },
    (cited) => openPage(cited).catch((): PageResult => ({ status: "error" })),
    { dedupingInterval: 10 * 60 * 1000 },
  );

  return (
    <DialogContent finalFocus={() => trigger} className="max-w-xl gap-4">
      <DialogHeader>
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <SliceGlyph className="size-3 text-berry" />
          <span className="truncate font-mono">{originOf(source)}</span>
        </p>
        <DialogTitle className="truncate">{source.filename}</DialogTitle>
        {source.claim && (
          <DialogDescription className="line-clamp-2">
            Cited for “{source.claim}”
          </DialogDescription>
        )}
      </DialogHeader>
      {!result ? (
        <p
          role="status"
          className={cn(
            frame,
            "flex items-center justify-center gap-2 text-[13px] text-muted-foreground",
          )}
        >
          <Spinner aria-hidden="true" className="size-3.5" />
          Loading the page…
        </p>
      ) : result.status === "ok" ? (
        <PageImage {...result} title={source.filename} />
      ) : result.status === "reconnect" ? (
        <Reconnect organization={organization} />
      ) : (
        <div className={notice}>
          {result.status === "missing"
            ? "This page isn’t available anymore."
            : "Couldn’t load the page."}
          {result.status === "error" && (
            <Button
              variant="outline"
              size="sm"
              // Emptied first, so it shows as loading again.
              onClick={() => void mutate(undefined)}
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </DialogContent>
  );
}

function Reconnect({ organization }: { organization: Organization }) {
  const { pending, connect } = useConnect();

  return (
    <div className={notice}>
      Access to {organization.name} ended.
      <Button variant="outline" size="sm" disabled={pending} onClick={connect}>
        {pending ? "Opening Mixedbread…" : "Sign in again"}
      </Button>
    </div>
  );
}

function PageImage({
  page,
  marked,
  title,
}: Extract<PageResult, { status: "ok" }> & { title: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const first = page.blocks[marked[0]];

  return (
    <>
      <div
        ref={scroller}
        className={cn(
          frame,
          // A hairline, so a white page keeps its edge on a light dialog.
          "h-auto max-h-[min(60vh,40rem)] scrollbar-thin overflow-y-auto overscroll-contain ring-1 ring-soft outline-offset-2 outline-ring focus-visible:outline-2",
        )}
      >
        <div
          className="relative"
          style={page.aspect ? { aspectRatio: page.aspect } : undefined}
        >
          {/* oxlint-disable-next-line nextjs/no-img-element -- a presigned, expiring image gains nothing from next/image */}
          <img
            src={page.image}
            alt={`A page of ${title}`}
            decoding="async"
            onLoad={(event) => {
              setLoaded(true);
              // A third of the way down, so the lines before it show too.
              const view = scroller.current;
              if (first && view) {
                view.scrollTop =
                  first.y * event.currentTarget.offsetHeight -
                  view.clientHeight / 3;
              }
            }}
            className={cn(
              "block w-full transition-opacity duration-200 ease-smooth motion-reduce:transition-none",
              !loaded && "opacity-0",
            )}
          />
          {loaded &&
            marked.map((index) => {
              const block = page.blocks[index];
              return (
                <mark
                  key={index}
                  style={{
                    left: `${block.x * 100}%`,
                    top: `${block.y * 100}%`,
                    width: `${block.width * 100}%`,
                    height: `${block.height * 100}%`,
                  }}
                  className="absolute rounded-[3px] bg-berry/12 outline-2 outline-offset-2 outline-berry/75 motion-safe:animate-fade"
                >
                  <span className="sr-only">{block.text}</span>
                </mark>
              );
            })}
        </div>
      </div>
      <a
        href={page.original}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 self-start text-xs text-muted-foreground outline-offset-2 outline-ring transition-colors hover:text-foreground focus-visible:outline-2"
      >
        <ArrowUpRightIcon className="size-3 shrink-0" />
        Open original
      </a>
    </>
  );
}
