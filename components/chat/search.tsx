"use client";

import { cn } from "cn";
import { ChevronRightIcon, GlobeIcon, LayersIcon } from "lucide-react";
import { memo, useState } from "react";
import { Toasting } from "@/components/brand/bakery";
import { SliceGlyph } from "@/components/brand/slice";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type Source, sourceTitle } from "@/lib/mixedbread/citations";
import type { Step } from "@/lib/mixedbread/research";
import type { ChatMessage } from "@/lib/search-tool";
import {
  ActivityPanel,
  ActivityTrigger,
  formatSeconds,
  LiveLine,
  StatusDot,
  useElapsed,
} from "./activity";
import { badge, originOf, SourcePreview, useHighlight } from "./citation";

export type SearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-search" }
>;

type State = "running" | "done" | "failed" | "stopped";

/** Searches that keep a live line while they run; the rest are a count. */
const LIVE_TASKS = 4;
/** Listed until the rest are asked for. */
const FIRST_TASKS = 6;
const FIRST_FILES = 6;
const FIRST_CHUNKS = 5;
/** From this many on, one search's steps fold into one line. */
const MANY_STEPS = 9;

/** One search the model asked for. */
interface Task {
  id: string;
  query?: string;
  state: State;
  steps: Step[];
}

/** A cited chunk, with the label each search that found it gave it. */
interface Chunk {
  source: Source;
  labels: Set<string>;
}

/** A cited file or page, with its chunks in the order they sit in it. */
interface SourceFile {
  key: string;
  chunks: Chunk[];
  labels: Set<string>;
}

/**
 * The searches the model ran in a row, as one trace: side by side within a
 * step, one after another across steps. While they run, a slice toasts over
 * a line for the newest step, or a line for each search among several; once
 * done, it pops up and the lines fold away behind the summary. Unfolded, the
 * trace lists the searches, their steps, and what they found by file.
 */
export const Search = memo(
  function Search({
    steps,
    live,
  }: {
    steps: SearchPart[][];
    /** Its message is still streaming; otherwise an unfinished search was stopped. */
    live: boolean;
  }) {
    const tasks: Task[] = [];
    const calls: Step[] = [];
    const files = new Map<string, SourceFile>();
    const chunks = new Map<string, Chunk>();
    let queries = "";
    let settled = 0;
    let found = false;
    let read = 0;
    let ms = 0;
    for (const step of steps) {
      // Searches side by side take as long as the longest.
      let longest = 0;
      for (const part of step) {
        const output =
          part.state === "output-available" ? part.output : undefined;
        const done = output?.status === "done" ? output : undefined;
        const state: State =
          part.state === "output-error"
            ? "failed"
            : done
              ? "done"
              : live
                ? "running"
                : "stopped";
        const query = part.input?.query;
        tasks.push({
          id: part.toolCallId,
          query,
          state,
          steps: output?.calls ?? [],
        });
        for (const call of output?.calls ?? []) calls.push(call);
        if (query) queries += `${queries && ", "}“${query}”`;
        if (state === "done" || state === "failed") settled++;
        if (!done) continue;
        found = true;
        read += done.read;
        longest = Math.max(longest, done.ms);
        for (const source of done.sources) add(files, chunks, source);
      }
      ms += longest;
    }
    const cited = Array.from(files.values());
    for (const file of cited) file.chunks.sort(byPlace);
    const state: State =
      settled < tasks.length
        ? live
          ? "running"
          : "stopped"
        : found
          ? "done"
          : "failed";
    const several = tasks.length > 1;
    // Toast can answer from what it read without citing any of it.
    const what =
      state === "done"
        ? chunks.size > 0
          ? plural(chunks.size, "source")
          : read > 0
            ? `${plural(read, "result")}, none cited`
            : "Nothing found"
        : several
          ? `${settled}/${tasks.length}`
          : calls.length > 0
            ? plural(calls.length, "step")
            : undefined;

    return (
      <Collapsible
        data-slot="activity"
        disabled={
          state !== "running" &&
          !several &&
          calls.length === 0 &&
          cited.length === 0
        }
      >
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
          detail={queries}
          meta={
            (state === "running" || state === "done") && (
              <Meta what={what} ms={state === "done" ? ms : undefined} />
            )
          }
        />
        {state === "running" && <Live tasks={tasks} />}
        <CollapsibleContent hiddenUntilFound>
          <ActivityPanel>
            {several && <TaskList tasks={tasks} />}
            {calls.length > 0 && (
              <StepList
                steps={calls}
                folded={several || calls.length >= MANY_STEPS}
              />
            )}
            {cited.length > 0 && <SourceList files={cited} />}
          </ActivityPanel>
        </CollapsibleContent>
      </Collapsible>
    );
  },
  // While the answer streams, finished searches keep their input and output.
  (previous, next) =>
    previous.live === next.live && same(previous.steps, next.steps),
);

function same(a: SearchPart[][], b: SearchPart[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      const x = a[i][j];
      const y = b[i][j];
      if (
        x.state !== y.state ||
        x.input !== y.input ||
        x.output !== y.output ||
        x.errorText !== y.errorText
      ) {
        return false;
      }
    }
  }
  return true;
}

/** Files one row each, and chunks found again under another label merged. */
function add(
  files: Map<string, SourceFile>,
  chunks: Map<string, Chunk>,
  source: Source,
) {
  const url = source.type === "url";
  const key = url ? source.url : source.fileId;
  let file = files.get(key);
  if (!file) {
    file = { key, chunks: [], labels: new Set() };
    files.set(key, file);
  }
  file.labels.add(source.label);
  const at = url ? source.url : source.chunkId;
  const chunk = chunks.get(at);
  if (chunk) {
    chunk.labels.add(source.label);
    return;
  }
  const entry = { source, labels: new Set([source.label]) };
  chunks.set(at, entry);
  file.chunks.push(entry);
}

/** Where a chunk sits in its file, from 1: for a visually parsed PDF, its page. */
function place(source: Source): number {
  return source.type === "file" ? source.chunkIndex + 1 : 0;
}

function byPlace(a: Chunk, b: Chunk): number {
  return place(a.source) - place(b.source);
}

/**
 * How far the searches are, or what they found, and the time: so far, from
 * 3s on, or in all. A leaf, so the clock ticks only here.
 */
function Meta({ what, ms }: { what?: string; ms?: number }) {
  const elapsed = useElapsed(ms === undefined);
  const seconds = ms === undefined ? elapsed : ms / 1000;
  const time =
    seconds && (ms !== undefined || seconds >= 3)
      ? formatSeconds(seconds)
      : undefined;
  return what && time ? `${what} · ${time}` : (what ?? time);
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** Steps by the run they came from, in the order the runs first spoke up. */
function runsOf(steps: Step[]): Map<string, Step[]> {
  const runs = new Map<string, Step[]>();
  for (const step of steps) {
    const name = step.group ?? "";
    const run = runs.get(name);
    if (run) run.push(step);
    else runs.set(name, [step]);
  }
  return runs;
}

/**
 * What is happening now, replaced in place as it goes. Among several
 * searches, a line for each one still running and a count past the first
 * few; for one, its newest step, or a line for each run side by side.
 */
function Live({ tasks }: { tasks: Task[] }) {
  const lines: {
    key: string;
    state: Step["status"];
    name?: string;
    text: string;
  }[] = [];
  let more = 0;
  if (tasks.length > 1) {
    for (const task of tasks) {
      if (task.state !== "running") continue;
      if (lines.length === LIVE_TASKS) more++;
      else {
        const text = latest(task.steps);
        lines.push({ key: task.id, state: "running", name: task.query, text });
      }
    }
  } else {
    const [{ steps }] = tasks;
    const runs = runsOf(steps);
    if (runs.size < 2) return <LiveLine text={latest(steps)} />;
    for (const [name, run] of runs) {
      lines.push({
        key: name,
        state: run.some((step) => step.status === "running")
          ? "running"
          : run.every((step) => step.status === "failed")
            ? "failed"
            : "done",
        name,
        text: latest(run, true),
      });
    }
  }

  return (
    <ul className="mt-0.5 ml-7 flex flex-col text-[12.5px] text-muted-foreground/80">
      {lines.map(({ key, state, name, text }) => (
        <li
          key={key}
          className="flex h-5 min-w-0 items-center gap-2 motion-safe:animate-swap-in"
        >
          <StatusDot state={state} />
          <span className="max-w-[45%] shrink-0 truncate text-foreground/75">
            {name}
          </span>
          <span key={text} className="truncate motion-safe:animate-swap-in">
            {text}
          </span>
        </li>
      ))}
      {more > 0 && <li className="h-5 pl-3.5">{more} more</li>}
    </ul>
  );
}

/** Each search the model asked for: the first few, and the rest on request. */
function TaskList({ tasks }: { tasks: Task[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? tasks : tasks.slice(0, FIRST_TASKS);

  return (
    <div className="flex flex-col gap-1.5">
      <ol aria-label="Searches" className="flex flex-col gap-1.5">
        {shown.map((task) => (
          <li
            key={task.id}
            className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground motion-safe:animate-rise"
          >
            <StatusDot state={task.state} />
            <span className="truncate text-foreground/75">{task.query}</span>
            {task.state === "failed" && (
              <span className="shrink-0">· failed</span>
            )}
          </li>
        ))}
      </ol>
      {!all && tasks.length > FIRST_TASKS && (
        <More count={tasks.length - FIRST_TASKS} onClick={() => setAll(true)} />
      )}
    </div>
  );
}

function More({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 cursor-pointer self-start rounded-md px-1 text-[12.5px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2"
    >
      {count} more
    </button>
  );
}

const nouns: Record<Step["kind"], [string, string]> = {
  search: ["search", "searches"],
  grep: ["scan", "scans"],
  filter: ["filter", "filters"],
  metadata: ["metadata check", "metadata checks"],
  read: ["read", "reads"],
  stores: ["store lookup", "store lookups"],
  other: ["step", "steps"],
};

/**
 * The steps, under each run when several ran side by side. Folded, they
 * are one line, "12 searches · 3 reads", that unfolds into all of them.
 */
function StepList({ steps, folded }: { steps: Step[]; folded: boolean }) {
  const runs = runsOf(steps);
  const list =
    runs.size > 1 ? (
      <ol className="flex flex-col gap-3">
        {Array.from(runs, ([name, steps]) => (
          <Group key={name} name={name} steps={steps} />
        ))}
      </ol>
    ) : (
      <Steps steps={steps} />
    );
  if (!folded) return list;

  const counts = new Map<Step["kind"], number>();
  let failed = 0;
  for (const step of steps) {
    // Steps saved before they had kinds count as plain steps.
    const kind = step.kind in nouns ? step.kind : "other";
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (step.status === "failed") failed++;
  }
  let summary = "";
  for (const [kind, count] of counts) {
    summary += `${summary && " · "}${count} ${nouns[kind][count === 1 ? 0 : 1]}`;
  }
  if (failed > 0) summary += ` · ${failed} failed`;

  return (
    <Collapsible>
      <CollapsibleTrigger className="group/steps -ml-1 flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-[12.5px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2">
        <span className="truncate">{summary}</span>
        <ChevronRightIcon className="size-3 shrink-0 opacity-60 transition-transform duration-300 ease-smooth group-data-panel-open/steps:rotate-90 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsibleContent hiddenUntilFound>
        <div className="pt-2">{list}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** What the searches cited, a row per file: the first few, and the rest on request. */
function SourceList({ files }: { files: SourceFile[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? files : files.slice(0, FIRST_FILES);

  return (
    <div className="flex flex-col gap-1">
      <ol
        aria-label="Sources found"
        data-card-group=""
        className="flex flex-col"
      >
        {shown.map((file, index) => (
          <FileRow key={file.key} file={file} index={index} />
        ))}
      </ol>
      {!all && files.length > FIRST_FILES && (
        <More count={files.length - FIRST_FILES} onClick={() => setAll(true)} />
      )}
    </div>
  );
}

const nameText =
  "truncate text-foreground/80 transition-colors group-hover/source:text-foreground group-data-[lit=true]/source:text-foreground";
const originText =
  "ml-auto max-w-[45%] shrink-0 truncate pl-3 font-mono text-[11px] text-muted-foreground/80";

/**
 * A file and what was cited in it. With one chunk the row previews it; with
 * more, each gets a marker with its page or place, and pointing at the file
 * lights all of them, here and in the answer.
 */
function FileRow({ file, index }: { file: SourceFile; index: number }) {
  const highlight = useHighlight();
  const [all, setAll] = useState(false);
  const [first] = file.chunks;
  const title = sourceTitle(first.source);
  const glyph = (
    <SliceGlyph
      className="size-3 text-berry motion-safe:animate-settle"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    />
  );

  if (file.chunks.length === 1) {
    return (
      <li>
        <SourcePreview
          source={first.source}
          labels={first.labels}
          align="start"
          className="group/source flex h-6.5 w-full min-w-0 items-center gap-2 rounded-md text-left text-[12.5px] outline-offset-0 outline-ring focus-visible:outline-2 aria-[haspopup=dialog]:cursor-pointer"
        >
          {glyph}
          <span className={nameText}>{title}</span>
          <span className={originText}>{originOf(first.source)}</span>
        </SourcePreview>
      </li>
    );
  }

  const shown = all ? file.chunks : file.chunks.slice(0, FIRST_CHUNKS);
  const kind =
    first.source.type === "file" && first.source.image ? "page" : "passage";
  return (
    <li
      onPointerEnter={() => highlight.set(file.labels)}
      onPointerLeave={() => highlight.set(undefined)}
      className="group/source flex min-w-0 items-start gap-2 text-[12.5px]"
    >
      <span className="flex h-6.5 items-center">{glyph}</span>
      {/* Past the room the name leaves, the markers wrap under it. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1">
        <span
          className={cn(
            nameText,
            "max-w-full pr-1 group-has-data-[lit=true]/source:text-foreground",
          )}
        >
          {title}
        </span>
        {shown.map(({ source, labels }) => (
          <SourcePreview
            key={source.label}
            source={source}
            labels={labels}
            rest={file.labels}
            align="start"
            aria-label={`${title}, ${kind} ${place(source)}`}
            className={cn(badge, marker)}
          >
            {place(source)}
          </SourcePreview>
        ))}
        {!all && file.chunks.length > FIRST_CHUNKS && (
          <button
            type="button"
            aria-label={`${file.chunks.length - FIRST_CHUNKS} more`}
            onClick={() => setAll(true)}
            className={cn(badge, marker, "hover:bg-soft hover:text-foreground")}
          >
            +{file.chunks.length - FIRST_CHUNKS}
          </button>
        )}
      </span>
      <span className={cn(originText, "leading-6.5")}>
        {originOf(first.source)}
      </span>
    </li>
  );
}

const marker = "flex h-4.5 min-w-4.5 shrink-0 px-1 text-[10.5px]";

/** One run's steps under its name. */
function Group({ name, steps }: { name: string; steps: Step[] }) {
  const Glyph = name === "Web" ? GlobeIcon : LayersIcon;

  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <p className="flex min-w-0 items-center gap-2 text-[12.5px]">
        <Glyph
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground"
        />
        <span className="truncate font-medium text-foreground/80">{name}</span>
      </p>
      {/* Dots centered under the glyph, so each run reads as one column. */}
      <Steps steps={steps} className="pl-[3px]" />
    </li>
  );
}

/** The step to show on a live line: the newest one, or what comes next. */
function latest(steps: Step[], lane = false): string {
  const step = steps.at(-1);
  if (!step) return "Planning the search";
  if (steps.every((step) => step.status !== "running")) {
    // A run that finished early rests on its last step, done.
    return lane ? line(step, "done") : "Writing up findings";
  }
  return line(step, "live");
}

function line(step: Step, tense: "live" | "done"): string {
  const words = describe(step);
  let text = words[tense];
  if (words.detail) text += ` ${words.detail}`;
  if (step.store) text += ` in ${step.store}`;
  return text;
}

function Steps({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-1.5", className)}>
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </ol>
  );
}

function StepRow({ step }: { step: Step }) {
  const { done, detail } = describe(step);
  // Reading passages and looking through stores already say how many.
  const results =
    step.kind === "read" || step.kind === "stores" ? undefined : step.results;
  let filters = "";
  for (const filter of step.filters ?? []) {
    filters += `${filters && " · "}${formatFilter(filter)}`;
  }

  return (
    <li className="flex min-w-0 flex-col text-[12.5px] text-muted-foreground motion-safe:animate-rise">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot state={step.status} />
        <span className="shrink-0">{done}</span>
        {detail && (
          <span className="truncate font-mono text-[11.5px] text-foreground/70">
            {detail}
          </span>
        )}
        {step.store && (
          <span className="max-w-[40%] shrink-0 truncate">in {step.store}</span>
        )}
        {results !== undefined && (
          <span className="ml-auto shrink-0 pl-1 text-muted-foreground/80 tabular-nums">
            {plural(results, "result")}
          </span>
        )}
        {/* Mostly Toast retrying on its own, so the reason stays with Toast. */}
        {step.status === "failed" && <span className="shrink-0">· failed</span>}
      </div>
      {/* Under the text, clear of the dot. */}
      {filters && (
        <p className="truncate pl-3.5 font-mono text-[11.5px] text-muted-foreground/80">
          where {filters}
        </p>
      )}
    </li>
  );
}

const list = new Intl.ListFormat("en");

/** A step in words, as it happens and once it is done. */
function describe(step: Step): { live: string; done: string; detail?: string } {
  switch (step.kind) {
    case "search":
      return {
        live: "Searching",
        done: "Searched",
        detail:
          step.queries &&
          list.format(step.queries.map((query) => `“${query}”`)),
      };
    case "grep":
      return {
        live: "Scanning for",
        done: "Scanned for",
        detail: step.pattern && `“${step.pattern}”`,
      };
    case "filter":
      return { live: "Filtering by metadata", done: "Filtered by metadata" };
    case "metadata":
      return { live: "Checking metadata", done: "Checked metadata" };
    case "read": {
      const passages =
        step.results === undefined
          ? "passages"
          : plural(step.results, "passage");
      return { live: `Reading ${passages}`, done: `Read ${passages}` };
    }
    case "stores": {
      const stores = step.stores ?? [];
      let detail = "";
      for (let i = 0; i < stores.length && i < 3; i++) {
        detail += `${i > 0 ? ", " : ""}${stores[i].name}`;
      }
      if (stores.length > 3) detail += ` +${stores.length - 3}`;
      return {
        live: "Looking through stores",
        done:
          stores.length > 0
            ? `Looked through ${plural(stores.length, "store")}`
            : "Looked through stores",
        detail: detail || undefined,
      };
    }
    default:
      return {
        live: "Running",
        done: "Ran",
        detail: step.tool?.replace(/_call$/, ""),
      };
  }
}

/** How each metadata comparison reads in a sentence. */
const operators: Record<string, string> = {
  eq: "is",
  not_eq: "is not",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  in: "is",
  not_in: "not in",
  like: "like",
  not_like: "not like",
  contains: "contains",
  starts_with: "starts with",
  regex: "matches",
};

/** A metadata condition as a reader would say it: `year ≥ 2024`, `lang is “en” or “de”`. */
function formatFilter({
  key,
  operator,
  value,
}: NonNullable<Step["filters"]>[number]): string {
  const verb = operators[operator] ?? operator.replaceAll("_", " ");
  const shown =
    operator === "regex" && typeof value === "string"
      ? `/${value}/`
      : formatValue(value, operator === "in" ? " or " : ", ");
  return `${key} ${verb} ${shown}`;
}

function formatValue(value: unknown, separator = ", "): string {
  if (typeof value === "string") return `“${value}”`;
  if (!Array.isArray(value)) return JSON.stringify(value) ?? "empty";
  let text = "";
  for (const item of value) text += `${text && separator}${formatValue(item)}`;
  return text;
}
