"use client";

import { cn } from "cn";
import { GlobeIcon, LayersIcon } from "lucide-react";
import { memo, useSyncExternalStore } from "react";
import { Toasting } from "@/components/brand/bakery";
import { SliceGlyph } from "@/components/brand/slice";
import { originOf, type Source, sourceTitle } from "@/lib/mixedbread/citations";
import type { Step } from "@/lib/mixedbread/research";
import type { ChatMessage } from "@/lib/search-tool";
import {
  Activity,
  formatSeconds,
  LiveLine,
  More,
  plural,
  type State,
  StatusDot,
  useFirst,
} from "./activity";
import { badge, light, SourcePreview } from "./citation";

export type SearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-search" }
>;

const LIVE_TASKS = 4;
const FIRST_TASKS = 6;
const FIRST_STEPS = 6;
const FIRST_FILES = 6;
const FIRST_CHUNKS = 5;

interface Task {
  id: string;
  query?: string;
  state: State;
  steps: Step[];
}

const labels: Record<State, React.ReactNode> = {
  running: (
    <span className="text-shimmer motion-safe:animate-shimmer">Searching</span>
  ),
  done: "Searched",
  failed: <span className="text-destructive">Search failed</span>,
  stopped: "Search stopped",
};

export const Search = memo(
  function Search({ steps, live }: { steps: SearchPart[][]; live: boolean }) {
    const unsettled: State = live ? "running" : "stopped";
    const tasks: Task[] = [];
    const calls: Step[] = [];
    const sources: Source[] = [];
    let queries = "";
    let settled = 0;
    let found = false;
    let read = 0;
    let ms = 0;
    let started: number | undefined;
    for (const step of steps) {
      // Searches side by side take as long as the longest.
      let longest = 0;
      for (const part of step) {
        const output =
          part.state === "output-available" ? part.output : undefined;
        const done = output?.status === "done" ? output : undefined;
        const state: State =
          part.state === "output-error" ? "failed" : done ? "done" : unsettled;
        const query = part.input?.query;
        const taskSteps = output?.calls ?? [];
        started ??= output?.started;
        tasks.push({ id: part.toolCallId, query, state, steps: taskSteps });
        for (const call of taskSteps) calls.push(call);
        if (query) queries += `${queries && ", "}“${query}”`;
        if (state === "done" || state === "failed") settled++;
        if (!done) continue;
        found = true;
        read += done.read;
        longest = Math.max(longest, done.ms);
        for (const source of done.sources) sources.push(source);
      }
      ms += longest;
    }
    const files = filesOf(sources);
    let cited = 0;
    for (const file of files) cited += file.chunks.length;
    const state: State =
      settled < tasks.length ? unsettled : found ? "done" : "failed";
    const several = tasks.length > 1;
    // Toast can answer from what it read without citing any of it.
    const what =
      state === "done"
        ? cited > 0
          ? plural(cited, "source")
          : read > 0
            ? `${plural(read, "result")}, none cited`
            : "Nothing found"
        : several
          ? `${settled}/${tasks.length}`
          : calls.length > 0
            ? plural(calls.length, "step")
            : undefined;

    return (
      <Activity
        indicator={<Toasting state={state} />}
        label={labels[state]}
        detail={queries}
        meta={
          (state === "running" || state === "done") && (
            <Meta
              what={what}
              ms={state === "done" ? ms : undefined}
              started={started}
            />
          )
        }
        status={state === "running" && <Live tasks={tasks} />}
        disabled={
          state !== "running" &&
          !several &&
          calls.length === 0 &&
          files.length === 0
        }
      >
        {several && <TaskList tasks={tasks} />}
        {calls.length > 0 && <StepList steps={calls} />}
        {files.length > 0 && <SourceList files={files} />}
      </Activity>
    );
  },
  // While the answer streams, finished searches keep their input and output.
  (previous, next) =>
    previous.live === next.live && same(previous.steps, next.steps),
);

function same(a: SearchPart[][], b: SearchPart[][]): boolean {
  if (a.length !== b.length) return false;
  for (const [i, step] of a.entries()) {
    if (step.length !== b[i].length) return false;
    for (const [j, x] of step.entries()) {
      const y = b[i][j];
      if (x.state !== y.state || x.input !== y.input || x.output !== y.output)
        return false;
    }
  }
  return true;
}

let clock = 0;
const now = () => clock;
const still = () => () => {};

function subscribeClock(listener: () => void) {
  const ticker = setInterval(() => {
    clock = Date.now();
    listener();
  }, 500);
  return () => clearInterval(ticker);
}

/** A leaf, so the clock ticks only here. */
function Meta({
  what,
  ms,
  started,
}: {
  what?: string;
  ms?: number;
  /** When the first search began, by the server's clock. */
  started?: number;
}) {
  const running = ms === undefined;
  const time = useSyncExternalStore(running ? subscribeClock : still, now, now);
  const seconds = running
    ? started && Math.max(0, time - started) / 1000
    : ms / 1000;
  const shown =
    seconds && (!running || seconds >= 3) ? formatSeconds(seconds) : undefined;
  return what && shown ? `${what} · ${shown}` : (what ?? shown);
}

function Live({ tasks }: { tasks: Task[] }) {
  const lines: { key: string; state: State; name?: string; text: string }[] =
    [];
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

function TaskList({ tasks }: { tasks: Task[] }) {
  const { shown, more, showAll } = useFirst(tasks, FIRST_TASKS);

  return (
    <div className="flex flex-col gap-1.5">
      <ol
        aria-label="Searches"
        tabIndex={-1}
        className="flex flex-col gap-1.5 rounded-md outline-offset-2 outline-ring focus-visible:outline-2"
      >
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
      {more > 0 && <More count={more} onClick={showAll} />}
    </div>
  );
}

function runsOf(steps: Step[]) {
  return Map.groupBy(steps, (step) => step.group ?? "");
}

function latest(steps: Step[], lane = false): string {
  const step = steps.at(-1);
  if (!step) return "Planning the search";
  const running = steps.some((step) => step.status === "running");
  if (!running && !lane) return "Writing up findings";
  const words = describe(step);
  // A run that finished early rests on its last step, done.
  let text = running ? words.live : words.done;
  if (words.detail) text += ` ${words.detail}`;
  if (step.store) text += ` in ${step.store}`;
  return text;
}

function StepList({ steps }: { steps: Step[] }) {
  const runs = runsOf(steps);
  if (runs.size < 2) return <Steps steps={steps} />;
  return (
    <ol className="flex flex-col gap-3">
      {Array.from(runs, ([name, steps]) => {
        const Glyph = name === "Web" ? GlobeIcon : LayersIcon;
        return (
          <li key={name} className="flex min-w-0 flex-col gap-1.5">
            <p className="flex min-w-0 items-center gap-2 text-[12.5px]">
              <Glyph
                aria-hidden="true"
                className="size-3 shrink-0 text-muted-foreground"
              />
              <span className="truncate font-medium text-foreground/80">
                {name}
              </span>
            </p>
            {/* Dots centered under the glyph, so each run reads as one column. */}
            <Steps steps={steps} className="pl-[3px]" />
          </li>
        );
      })}
    </ol>
  );
}

function Steps({ steps, className }: { steps: Step[]; className?: string }) {
  const { shown, more, showAll } = useFirst(steps, FIRST_STEPS);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <ol
        tabIndex={-1}
        className="flex flex-col gap-1.5 rounded-md outline-offset-2 outline-ring focus-visible:outline-2"
      >
        {shown.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </ol>
      {more > 0 && <More count={more} onClick={showAll} />}
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const { done, detail } = describe(step);
  // Reading passages and looking through stores already say how many.
  const results =
    step.kind === "read" || step.kind === "stores" ? undefined : step.results;
  // As a reader would say it: `year ≥ 2024`, `lang is “en” or “de”`.
  let filters = "";
  for (const { key, operator, value } of step.filters ?? []) {
    const verb = operators[operator] ?? operator.replaceAll("_", " ");
    const shown =
      operator === "regex" && typeof value === "string"
        ? `/${value}/`
        : formatValue(value, operator === "in" ? " or " : ", ");
    filters += `${filters && " · "}${key} ${verb} ${shown}`;
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
      {filters && (
        <p className="truncate pl-3.5 font-mono text-[11.5px] text-muted-foreground/80">
          where {filters}
        </p>
      )}
    </li>
  );
}

const list = new Intl.ListFormat("en");

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
      const count =
        stores.length > 0 ? plural(stores.length, "store") : "stores";
      let detail = "";
      for (let i = 0; i < stores.length && i < 3; i++) {
        detail += `${i > 0 ? ", " : ""}${stores[i].name}`;
      }
      if (stores.length > 3) detail += ` +${stores.length - 3}`;
      return {
        live: "Looking through stores",
        done: `Looked through ${count}`,
        detail: detail || undefined,
      };
    }
    case "other":
      return {
        live: "Running",
        done: "Ran",
        detail: step.tool?.replace(/_call$/, ""),
      };
  }
}

// The rest read as their names, such as `starts with`.
const operators: Record<string, string> = {
  eq: "is",
  not_eq: "is not",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  in: "is",
  regex: "matches",
};

function formatValue(value: unknown, separator = ", "): string {
  if (typeof value === "string") return `“${value}”`;
  if (!Array.isArray(value)) return JSON.stringify(value) ?? "empty";
  let text = "";
  for (const item of value) text += `${text && separator}${formatValue(item)}`;
  return text;
}

interface Chunk {
  source: Source;
  labels: Set<string>;
}

interface SourceFile {
  key: string;
  chunks: Chunk[];
  labels: Set<string>;
}

function filesOf(sources: Source[]): SourceFile[] {
  const files = new Map<string, SourceFile>();
  const chunks = new Map<string, Chunk>();
  for (const source of sources) {
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
    if (chunk) chunk.labels.add(source.label);
    else {
      const entry = { source, labels: new Set([source.label]) };
      chunks.set(at, entry);
      file.chunks.push(entry);
    }
  }
  for (const file of files.values()) {
    file.chunks.sort((a, b) => place(a.source) - place(b.source));
  }
  return Array.from(files.values());
}

/** A chunk's place in its file, which for a visually parsed PDF is its page. */
function place(source: Source): number {
  return source.type === "file" ? source.chunkIndex + 1 : 0;
}

function SourceList({ files }: { files: SourceFile[] }) {
  const { shown, more, showAll } = useFirst(files, FIRST_FILES);

  return (
    <div className="flex flex-col gap-1">
      <ol aria-label="Sources found" className="flex flex-col">
        {shown.map((file, index) => (
          <FileRow key={file.key} file={file} index={index} />
        ))}
      </ol>
      {more > 0 && <More count={more} onClick={showAll} />}
    </div>
  );
}

const nameText =
  "truncate text-foreground/80 transition-colors group-hover/source:text-foreground group-data-lit/source:text-foreground";
const originText =
  "ml-auto max-w-[45%] shrink-0 truncate pl-3 font-mono text-[11px] text-muted-foreground/80";
const marker = "flex h-4.5 min-w-4.5 shrink-0 px-1 text-[10.5px]";

function FileRow({ file, index }: { file: SourceFile; index: number }) {
  const { shown, more, showAll } = useFirst(file.chunks, FIRST_CHUNKS);
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

  const kind =
    first.source.type === "file" && first.source.image ? "page" : "passage";
  return (
    <li
      onPointerEnter={(event) => light(event.currentTarget, file.labels)}
      onPointerLeave={(event) => light(event.currentTarget)}
      className="group/source flex min-w-0 items-start gap-2 text-[12.5px]"
    >
      <span className="flex h-6.5 items-center">{glyph}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1">
        <span
          className={cn(
            nameText,
            "max-w-full pr-1 group-has-data-lit/source:text-foreground",
          )}
        >
          {title}
        </span>
        <span className="contents">
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
        </span>
        {more > 0 && (
          <button
            type="button"
            aria-label={`${more} more`}
            onClick={showAll}
            className={cn(badge, marker, "hover:bg-soft hover:text-foreground")}
          >
            +{more}
          </button>
        )}
      </span>
      <span className={cn(originText, "leading-6.5")}>
        {originOf(first.source)}
      </span>
    </li>
  );
}
