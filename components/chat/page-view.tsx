"use client";

import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";
import { Suspense, use, useRef, useState } from "react";
import { openPage, type PageResult } from "@/app/(chat)/actions";
import { SliceGlyph } from "@/components/brand/slice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { Source } from "@/lib/mixedbread/citations";
import type { Page } from "@/lib/mixedbread/files";
import type { Organization } from "@/lib/sources";
import { useConnect } from "./sources-provider";

type FileSource = Extract<Source, { type: "file" }>;

// Its links expire within the hour, so a page opened again soon reuses them.
const pages = new Map<
  string,
  { expires: number; result: Promise<PageResult> }
>();

function pageOf(
  source: FileSource,
  organization: Organization,
  attempt: number,
): Promise<PageResult> {
  const key = `${source.chunkId} ${source.claim} ${attempt}`;
  const cached = pages.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;
  const result = openPage({
    organizationId: organization.id,
    storeId: source.storeId,
    chunkId: source.chunkId,
    claim: source.claim,
  }).catch((): PageResult => ({ status: "error" }));
  pages.set(key, { expires: Date.now() + 10 * 60 * 1000, result });
  return result;
}

// A tall page fills the height its loading stand-in held, so the dialog
// holds still as it loads.
const frame = "h-[min(60vh,40rem)] rounded-lg bg-soft";

/** The cited page, loaded when opened, with the passage it stands for marked. */
export function PageView({
  source,
  organization,
  origin,
  open,
  onOpenChange,
  finalFocus,
}: {
  source: FileSource;
  organization: Organization;
  origin: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes back to once it closes. */
  finalFocus: React.RefObject<HTMLElement | null>;
}) {
  const [attempt, setAttempt] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent finalFocus={finalFocus} className="max-w-xl gap-4">
        <DialogHeader>
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <SliceGlyph className="size-3 text-berry" />
            <span className="truncate font-mono">{origin}</span>
          </p>
          <DialogTitle className="truncate">{source.filename}</DialogTitle>
          {source.claim && (
            <DialogDescription className="line-clamp-2">
              Cited for “{source.claim}”
            </DialogDescription>
          )}
        </DialogHeader>
        <Suspense
          fallback={
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
          }
        >
          <PageBody
            source={source}
            organization={organization}
            attempt={attempt}
            onRetry={() => setAttempt(attempt + 1)}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

const notice =
  "flex flex-col items-center justify-center gap-3 rounded-lg bg-soft px-4 py-12 text-center text-[13px] text-pretty text-muted-foreground";

/** Rendered only while the dialog is open, so the page loads only then. */
function PageBody({
  source,
  organization,
  attempt,
  onRetry,
}: {
  source: FileSource;
  organization: Organization;
  attempt: number;
  onRetry: () => void;
}) {
  const page = use(pageOf(source, organization, attempt));
  if (page.status === "ok") {
    return (
      <PageImage
        page={page.page}
        marked={page.marked}
        title={source.filename}
      />
    );
  }
  if (page.status === "reconnect") {
    return <Reconnect organization={organization} />;
  }
  return (
    <div className={notice}>
      {page.status === "missing"
        ? "This page isn’t available anymore."
        : "Couldn’t load the page."}
      {page.status === "error" && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

function Reconnect({ organization }: { organization: Organization }) {
  const { pending, connect } = useConnect();

  return (
    <div className={notice}>
      Access to {organization.name} ended. Sign in again to see this page.
      <Button variant="outline" size="sm" disabled={pending} onClick={connect}>
        {pending ? "Opening Mixedbread…" : "Sign in again"}
      </Button>
    </div>
  );
}

/**
 * The page as an image, its space kept from the start. Once it loads, it
 * fades in already scrolled to the first marked block, and the marks follow.
 */
function PageImage({
  page,
  marked,
  title,
}: {
  page: Page;
  marked: number[];
  title: string;
}) {
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
                block && (
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
                )
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
