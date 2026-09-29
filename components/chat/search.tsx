"use client";

import { Toasting } from "@/components/brand/bakery";
import { SliceGlyph } from "@/components/brand/slice";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  type Source,
  sourceOrigin,
  sourceTitle,
} from "@/lib/mixedbread/citations";
import type { HostedCall } from "@/lib/mixedbread/research";
import type { ChatMessage } from "@/lib/search-tool";
import {
  ActivityPanel,
  ActivityTrigger,
  formatSeconds,
  LiveLine,
  StatusDot,
  useElapsed,
} from "./activity";

type SearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-search" }
>;

/**
 * A Toast run. While it searches, a slice toasts and one line follows its
 * newest step; once done, the toast pops up and the whole trace folds away
 * behind the summary.
 */
export function Search({
  part,
  live,
}: {
  part: SearchPart;
  /** Its message is still streaming; otherwise an unfinished search was stopped. */
  live: boolean;
}) {
  const failed = part.state === "output-error";
  const output = part.state === "output-available" ? part.output : undefined;
  const done = output?.status === "done";
  const running = live && !done && !failed;
  const calls = output?.calls ?? [];
  const sources = output?.status === "done" ? output.sources : [];
  const elapsed = useElapsed(running);
  const seconds =
    output?.status === "done" && output.ms !== undefined
      ? output.ms / 1000
      : elapsed;
  const query = part.input?.query;

  const state = failed
    ? "failed"
    : done
      ? "done"
      : running
        ? "running"
        : "stopped";

  return (
    <Collapsible data-slot="activity">
      <ActivityTrigger
        indicator={<Toasting state={state} />}
        label={
          state === "running" ? (
            <span className="text-shimmer motion-safe:animate-shimmer">
              Searching
            </span>
          ) : state === "done" ? (
            "Searched"
          ) : state === "failed" ? (
            <span className="text-destructive">Search failed</span>
          ) : (
            "Search stopped"
          )
        }
        detail={query ? `“${query}”` : undefined}
        meta={meta(state, calls, sources, seconds)}
      />
      {state === "running" && <LiveLine text={latestStep(calls)} />}
      <CollapsibleContent hiddenUntilFound>
        <ActivityPanel>
          {state === "failed" && part.state === "output-error" && (
            <p className="text-[12.5px] text-muted-foreground">
              {part.errorText}
            </p>
          )}
          {calls.length > 0 && (
            <ol className="flex flex-col gap-1.5">
              {calls.map((call) => (
                <Step key={call.id} call={call} />
              ))}
            </ol>
          )}
          {sources.length > 0 && (
            <ol aria-label="Sources found" className="flex flex-col">
              {sources.map((source, index) => (
                <SourceRow key={source.label} source={source} index={index} />
              ))}
            </ol>
          )}
        </ActivityPanel>
      </CollapsibleContent>
    </Collapsible>
  );
}

function meta(
  state: "running" | "done" | "failed" | "stopped",
  calls: HostedCall[],
  sources: Source[],
  seconds: number | undefined,
): string | undefined {
  const time =
    seconds !== undefined && (state === "done" || seconds >= 3)
      ? formatSeconds(seconds)
      : undefined;
  if (state === "running") {
    const steps =
      calls.length > 0
        ? `${calls.length} ${calls.length === 1 ? "step" : "steps"}`
        : undefined;
    return steps && time ? `${steps} · ${time}` : (steps ?? time);
  }
  if (state === "done") {
    const found =
      sources.length === 0
        ? "Nothing found"
        : `${sources.length} ${sources.length === 1 ? "source" : "sources"}`;
    return time ? `${found} · ${time}` : found;
  }
  return undefined;
}

/** The step to show on the live line: the newest one, or what comes next. */
function latestStep(calls: HostedCall[]): string {
  const call = calls.at(-1);
  if (!call) return "Planning the search";
  if (calls.every((call) => call.status !== "in_progress")) {
    return "Writing up findings";
  }
  const { live, detail } = describe(call);
  return detail ? `${live} ${detail}` : live;
}

function Step({ call }: { call: HostedCall }) {
  const { done, detail } = describe(call);
  const failed = call.status === "failed";

  return (
    <li className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground motion-safe:animate-rise">
      <StatusDot
        state={
          failed ? "failed" : call.status === "in_progress" ? "running" : "done"
        }
      />
      <span className="shrink-0">{done}</span>
      {detail && (
        <span className="truncate font-mono text-[11.5px] text-foreground/70">
          {detail}
        </span>
      )}
      {failed && <span className="shrink-0 text-destructive">· failed</span>}
    </li>
  );
}

function SourceRow({ source, index }: { source: Source; index: number }) {
  const content = (
    <>
      <SliceGlyph
        className="size-3 text-berry motion-safe:animate-settle"
        style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      />
      <span className="truncate text-foreground/80 transition-colors group-hover/source:text-foreground">
        {sourceTitle(source)}
      </span>
      <span className="ml-auto shrink-0 pl-3 font-mono text-[11px] text-muted-foreground/80">
        {sourceOrigin(source)}
      </span>
    </>
  );
  const className =
    "group/source flex h-6.5 min-w-0 items-center gap-2 rounded-md text-[12.5px] outline-offset-0 outline-ring focus-visible:outline-2";

  return (
    <li>
      {source.type === "url" ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className={className}
        >
          {content}
        </a>
      ) : (
        <span className={className}>{content}</span>
      )}
    </li>
  );
}

const list = new Intl.ListFormat("en");

/** A step in words, as it happens and once it is done. */
function describe(call: HostedCall): {
  live: string;
  done: string;
  detail?: string;
} {
  switch (call.type) {
    case "search_corpus_call": {
      const queries = (call.queries ?? []).map((query) => `“${query}”`);
      return {
        live: "Searching",
        done: "Searched",
        detail: queries.length > 0 ? list.format(queries) : undefined,
      };
    }
    case "grep_call":
      return {
        live: "Scanning for",
        done: "Scanned for",
        detail: call.pattern ? `“${call.pattern}”` : undefined,
      };
    case "filter_chunks_call":
      return { live: "Filtering by metadata", done: "Filtered by metadata" };
    case "inspect_metadata_call":
      return { live: "Checking metadata", done: "Checked metadata" };
    case "get_chunks_call": {
      const count = call.chunk_ids?.length ?? 0;
      const passages = `${count} ${count === 1 ? "passage" : "passages"}`;
      return { live: `Reading ${passages}`, done: `Read ${passages}` };
    }
    default: {
      const name = call.type.replace(/_call$/, "").replaceAll("_", " ");
      return { live: name, done: name };
    }
  }
}
