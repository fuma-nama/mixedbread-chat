"use client";

import { cn } from "cn";
import { ChevronRightIcon, GlobeIcon, LayersIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Toasting } from "@/components/brand/bakery";
import { SliceGlyph } from "@/components/brand/slice";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type Source, sourceTitle } from "@/lib/mixedbread/citations";
import type { Step } from "@/lib/mixedbread/research";
import type { ChatMessage, SearchOutput } from "@/lib/search-tool";
import {
  ActivityPanel,
  ActivityTrigger,
  Fold,
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

type Done = Extract<SearchOutput, { status: "done" }>;

/** Lines listed until the rest are asked for: tasks, files shared out among stores, and a file's chunks. */
const FIRST_TASKS = 6;
const FIRST_FILES = 6;
const FIRST_CHUNKS = 5;
/** Tasks that keep a line while they run; the rest are a count. */
const LIVE_TASKS = 4;

type State = "running" | "done" | "failed" | "stopped";

/** One search the model asked for: its question, and how Toast is getting on. */
interface Task {
  id: string;
  query?: string;
  state: State;
  steps: Step[];
  error?: string;
}

/**
 * Every search of an answer as one trace, however many ran, and at once.
 * While they run, a slice toasts, with a line for the newest step of one
 * search or a line for each search running among several; once done, the
 * toast pops up and the lines fold away. Unfolded, the trace lists the
 * searches, their steps in one line, and what they found by store and file.
 */
export const Search = memo(
  function Search({
    parts,
    live,
  }: {
    parts: SearchPart[];
    /** Its message is still streaming; otherwise an unfinished search was stopped. */
    live: boolean;
  }) {
    const tasks: Task[] = [];
    const steps: Step[] = [];
    const found: Done[] = [];
    let settled = 0;
    let ms: number | undefined;
    for (const part of parts) {
      const output =
        part.state === "output-available" ? part.output : undefined;
      const done = output?.status === "done" ? output : undefined;
      const error = part.state === "output-error" ? part.errorText : undefined;
      const calls = output?.calls ?? [];
      tasks.push({
        id: part.toolCallId,
        query: part.input?.query,
        state: error ? "failed" : done ? "done" : live ? "running" : "stopped",
        steps: calls,
        error,
      });
      steps.push(...calls);
      if (done) found.push(done);
      if (done || error) settled++;
      // Searches side by side take as long as the longest; chats saved
      // before timing have no time.
      if (done && done.ms >= 0) ms = Math.max(ms ?? 0, done.ms);
    }
    const state: State =
      settled < tasks.length
        ? live
          ? "running"
          : "stopped"
        : found.length > 0
          ? "done"
          : "failed";
    const [task] = tasks;
    let running = 0;
    for (const step of steps) if (step.status === "running") running++;

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
          detail={tasks.length === 1 && task.query && `“${task.query}”`}
          meta={
            <Meta
              running={state === "running"}
              ms={state === "done" ? ms : undefined}
              count={tasks.length}
              settled={settled}
            />
          }
        />
        {tasks.length === 1 ? (
          <LiveLine
            text={state === "running" ? latest(steps) : undefined}
            running={running}
          />
        ) : (
          <TaskLines tasks={tasks} open={state === "running"} />
        )}
        <CollapsibleContent hiddenUntilFound>
          <ActivityPanel>
            {tasks.length === 1 ? (
              task.error && (
                <p className="text-[12.5px] text-muted-foreground">
                  {task.error}
                </p>
              )
            ) : (
              <TaskList tasks={tasks} />
            )}
            {steps.length > 0 && <StepList steps={steps} />}
            {found.length > 0 && <SourceList found={found} />}
          </ActivityPanel>
        </CollapsibleContent>
      </Collapsible>
    );
  },
  // While the answer streams, finished searches keep their input and output.
  (previous, next) =>
    previous.live === next.live &&
    previous.parts.length === next.parts.length &&
    previous.parts.every(
      (part, index) =>
        part.state === next.parts[index].state &&
        part.input === next.parts[index].input &&
        part.output === next.parts[index].output,
    ),
);

/**
 * Among several searches, how many are through, or how many ran; and how
 * long they took, or while they run the time so far from 3s on. A leaf, so
 * the clock ticks only here.
 */
function Meta({
  running,
  ms,
  count,
  settled,
}: {
  running: boolean;
  ms?: number;
  count: number;
  settled: number;
}) {
  const elapsed = useElapsed(running);
  const seconds =
    ms === undefined ? (running ? elapsed : undefined) : ms / 1000;
  let text = "";
  if (count > 1) text = running ? `${settled}/${count}` : `×${count}`;
  if (seconds !== undefined && (ms !== undefined || seconds >= 3)) {
    text += `${text && " · "}${formatSeconds(seconds)}`;
  }
  return text;
}

/** The newest step still running, else the last one. */
function latest(steps: Step[]): string | undefined {
  const step =
    steps.findLast((step) => step.status === "running") ?? steps.at(-1);
  return step && line(step, step.status === "running" ? "live" : "done");
}

function line(step: Step, tense: "live" | "done"): string {
  const words = describe(step);
  let text = words[tense];
  if (words.detail) text += ` ${words.detail}`;
  if (step.store) text += ` in ${step.store}`;
  return text;
}

/**
 * A line for each search running among several, with its newest step, and
 * a count for those past the first few. Once none runs, the last ones fold
 * away with the rest.
 */
function TaskLines({ tasks, open }: { tasks: Task[]; open: boolean }) {
  const lines: Task[] = [];
  let more = 0;
  for (const task of tasks) {
    if (task.state !== "running") continue;
    if (lines.length < LIVE_TASKS) lines.push(task);
    else more++;
  }
  if (lines.length === 0) {
    for (const task of tasks.slice(-LIVE_TASKS)) lines.push(task);
  }

  return (
    <Fold open={open}>
      <ul className="mt-0.5 ml-7 flex flex-col text-[12.5px]">
        {lines.map((task) => {
          const step = latest(task.steps);
          return (
            <li
              key={task.id}
              className="flex h-5 min-w-0 items-center gap-2 motion-safe:animate-swap-in"
            >
              <StatusDot state={task.state} />
              <span className="min-w-0 flex-1 truncate text-foreground/75">
                {task.query}
              </span>
              <span
                key={step}
                className="max-w-[45%] shrink-0 truncate text-muted-foreground/80 motion-safe:animate-swap-in max-sm:hidden"
              >
                {step}
              </span>
            </li>
          );
        })}
        {more > 0 && (
          <li className="h-5 pl-3.5 text-muted-foreground/80">+{more} more</li>
        )}
      </ul>
    </Fold>
  );
}

/** Each search the model asked for, the first few until the rest are asked for. */
function TaskList({ tasks }: { tasks: Task[] }) {
  const [all, setAll] = useState(false);
  // Failures lead, so a short list doesn't hide them.
  const ordered: Task[] = [];
  for (const task of tasks) if (task.error) ordered.push(task);
  for (const task of tasks) if (!task.error) ordered.push(task);
  const shown = all ? ordered : ordered.slice(0, FIRST_TASKS);

  return (
    <div className="flex flex-col gap-1">
      <ol aria-label="Searches" className="flex flex-col gap-1">
        {shown.map((task, index) => (
          <li
            key={task.id}
            className={cn(
              "flex min-w-0 flex-col text-[12.5px]",
              index >= FIRST_TASKS && "motion-safe:animate-fade",
            )}
          >
            <p className="flex min-w-0 items-center gap-2">
              <StatusDot state={task.state} />
              <span className="truncate text-foreground/75">{task.query}</span>
            </p>
            {task.error && (
              <p className="pl-3.5 text-pretty text-destructive/85">
                {task.error}
              </p>
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
      className="-ml-1 self-start rounded-md px-1 text-[12.5px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2"
    >
      {count} more
    </button>
  );
}

/** A store's or a run's name, under the web's globe or a stack of stores. */
function Heading({ web, children }: { web: boolean; children: string }) {
  const Glyph = web ? GlobeIcon : LayersIcon;
  return (
    <p className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
      <Glyph aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{children}</span>
    </p>
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

/** The steps in one line, "7 searches · 2 reads", unfolding into all of them. */
function StepList({ steps }: { steps: Step[] }) {
  const counts = new Map<Step["kind"], number>();
  const runs = new Map<string, Step[]>();
  let failed = 0;
  for (const step of steps) {
    // A step of an unknown kind counts as a plain one.
    const kind = step.kind in nouns ? step.kind : "other";
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (step.status === "failed") failed++;
    // Several runs side by side name themselves: the web, or an organization.
    const run = runs.get(step.group ?? "");
    if (run) run.push(step);
    else runs.set(step.group ?? "", [step]);
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
        <ol className="flex flex-col gap-2.5 pt-2">
          {Array.from(runs, ([name, steps]) => (
            <li key={name} className="flex min-w-0 flex-col gap-1">
              {name && <Heading web={name === "Web"}>{name}</Heading>}
              <ol className="flex flex-col gap-1">
                {steps.map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StepRow({ step }: { step: Step }) {
  const { done, detail } = describe(step);
  let filters = "";
  for (const filter of step.filters ?? []) {
    filters += `${filters && " · "}${formatFilter(filter)}`;
  }

  return (
    <li className="flex min-w-0 flex-col text-[12.5px] text-muted-foreground">
      <p className="flex min-w-0 items-center gap-2">
        <StatusDot state={step.status} />
        {/* A search is its queries; the line above says what it did. */}
        <span className="truncate text-foreground/75">
          {step.kind === "search" && detail
            ? detail
            : detail
              ? `${done} ${detail}`
              : done}
        </span>
        {step.store && (
          <span className="max-w-[40%] shrink-0 truncate">in {step.store}</span>
        )}
      </p>
      {/* Under the text, clear of the dot. */}
      {filters && (
        <p className="truncate pl-3.5 font-mono text-[11.5px]">
          where {filters}
        </p>
      )}
      {step.status === "failed" && (
        <p className="pl-3.5 text-pretty text-destructive/85">
          {step.error ?? "Failed"}
        </p>
      )}
    </li>
  );
}

/** A chunk, with its page or its place in a file of text, and a label for each search that found it. */
interface Chunk {
  source: Source;
  place?: number;
  labels: Set<string>;
}

interface SourceFile {
  id: string;
  name: string;
  /** In file order. */
  chunks: Chunk[];
  labels: Set<string>;
}

interface SourceGroup {
  id: string;
  name: string;
  web: boolean;
  files: SourceFile[];
}

/** What every search found, by store or the web, then by file. */
function groupsOf(found: Done[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  const files = new Map<string, SourceFile>();
  const chunks = new Map<string, Chunk>();
  for (const { sources } of found) {
    for (const source of sources ?? []) {
      const web = source.type === "url";
      const groupId = web ? "" : source.storeId;
      let group = groups.get(groupId);
      if (!group) {
        const name = web ? "Web" : originOf(source);
        group = { id: groupId, name, web, files: [] };
        groups.set(groupId, group);
      }
      const fileId = web ? source.url : source.fileId;
      let file = files.get(fileId);
      if (!file) {
        file = {
          id: fileId,
          name: sourceTitle(source),
          chunks: [],
          labels: new Set(),
        };
        files.set(fileId, file);
        group.files.push(file);
      }
      file.labels.add(source.label);
      const key = web ? source.url : source.chunkId;
      const chunk = chunks.get(key);
      if (chunk) chunk.labels.add(source.label);
      else {
        const entry = {
          source,
          // Sources saved before chunks had places have none.
          place: web ? undefined : source.chunkIndex + 1 || undefined,
          labels: new Set([source.label]),
        };
        chunks.set(key, entry);
        file.chunks.push(entry);
      }
    }
  }
  for (const file of files.values()) {
    file.chunks.sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  }
  return Array.from(groups.values());
}

/** Each store's first files, so none goes unseen, and the rest once asked for. */
function SourceList({ found }: { found: Done[] }) {
  const groups = useMemo(() => groupsOf(found), [found]);
  const [all, setAll] = useState(false);
  const room = Math.max(2, Math.floor(FIRST_FILES / groups.length));
  let hidden = 0;
  for (const group of groups) hidden += Math.max(0, group.files.length - room);

  return (
    <div className="flex flex-col gap-2.5">
      <ul aria-label="Sources" className="flex flex-col gap-2.5">
        {groups.map((group) => {
          const files = all ? group.files : group.files.slice(0, room);
          return (
            <li key={group.id} className="flex min-w-0 flex-col gap-0.5">
              <Heading web={group.web}>{group.name}</Heading>
              <ul className="flex flex-col">
                {files.map((file, index) => (
                  <FileRow key={file.id} file={file} shown={index >= room} />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {!all && hidden > 0 && (
        <More count={hidden} onClick={() => setAll(true)} />
      )}
    </div>
  );
}

const filename = "truncate text-foreground/80 transition-colors duration-150";
const marker = cn(badge, "flex h-4.5 min-w-4.5 shrink-0 px-1 text-[10.5px]");

/**
 * A file and what was found in it. With one chunk the row previews it; with
 * more, each gets its own marker, and pointing at the file lights up all of
 * them, here and in the answer.
 */
const FileRow = memo(function FileRow({
  file,
  shown,
}: {
  file: SourceFile;
  /** Listed on request, so it fades in. */
  shown: boolean;
}) {
  const highlight = useHighlight();
  const [all, setAll] = useState(false);
  const [first] = file.chunks;

  if (file.chunks.length === 1) {
    return (
      <li className={shown ? "motion-safe:animate-fade" : undefined}>
        <SourcePreview
          source={first.source}
          labels={first.labels}
          align="start"
          className="group/source flex h-6.5 w-full min-w-0 items-center gap-2 rounded-md text-left text-[12.5px] outline-offset-0 outline-ring focus-visible:outline-2 aria-[haspopup=dialog]:cursor-pointer"
        >
          <SliceGlyph className="size-3 text-berry" />
          <span
            className={cn(
              filename,
              "group-hover/source:text-foreground group-data-[lit=true]/source:text-foreground",
            )}
          >
            {file.name}
          </span>
        </SourcePreview>
      </li>
    );
  }

  const chunks = all ? file.chunks : file.chunks.slice(0, FIRST_CHUNKS);
  const page = first.source.type === "file" && first.source.image;
  return (
    <li
      onPointerEnter={() => highlight.set(file.labels)}
      onPointerLeave={() => highlight.set(undefined)}
      className={cn(
        "group/file flex min-h-6.5 items-start gap-2 text-[12.5px]",
        shown && "motion-safe:animate-fade",
      )}
    >
      <SliceGlyph className="mt-[7px] size-3 text-berry" />
      <span
        className={cn(
          filename,
          "min-w-0 flex-1 leading-6.5 group-hover/file:text-foreground",
        )}
      >
        {file.name}
      </span>
      {/* All of a long file's wrap, and the name keeps some room. */}
      <span className="flex max-w-3/5 flex-wrap justify-end gap-1 py-1">
        {chunks.map(({ source, place, labels }, index) => (
          <SourcePreview
            key={source.label}
            source={source}
            labels={labels}
            rest={file.labels}
            aria-label={`${file.name}, ${page ? "page" : "passage"} ${place ?? index + 1}`}
            className={cn(
              marker,
              index >= FIRST_CHUNKS && "motion-safe:animate-fade",
            )}
          >
            {place ?? index + 1}
          </SourcePreview>
        ))}
        {!all && file.chunks.length > FIRST_CHUNKS && (
          <button
            type="button"
            aria-label={`${file.chunks.length - FIRST_CHUNKS} more`}
            onClick={() => setAll(true)}
            className={cn(marker, "hover:bg-soft hover:text-foreground")}
          >
            +{file.chunks.length - FIRST_CHUNKS}
          </button>
        )}
      </span>
    </li>
  );
});

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
          : `${step.results} ${step.results === 1 ? "passage" : "passages"}`;
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
        done: "Looked through stores",
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
