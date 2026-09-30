"use client";

import { memo } from "react";
import { Toasting } from "@/components/brand/bakery";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { Source } from "@/lib/mixedbread/citations";
import type { Step } from "@/lib/mixedbread/research";
import type { ChatMessage } from "@/lib/search-tool";
import {
  ActivityPanel,
  ActivityTrigger,
  formatSeconds,
  LiveLine,
  More,
  plural,
  StatusDot,
  useElapsed,
  useFirst,
} from "./activity";
import { filesOf, SourceList } from "./search-files";
import { latest, runsOf, StepList } from "./search-steps";

export type SearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-search" }
>;

type State = "running" | "done" | "failed" | "stopped";

/** Searches that keep a live line while they run; the rest are a count. */
const LIVE_TASKS = 4;
/** Listed until the rest are asked for. */
const FIRST_TASKS = 6;

/** One search the model asked for. */
interface Task {
  id: string;
  query?: string;
  state: State;
  steps: Step[];
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
    const sources: Source[] = [];
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
        for (const source of done.sources) sources.push(source);
      }
      ms += longest;
    }
    const files = filesOf(sources);
    let cited = 0;
    for (const file of files) cited += file.chunks.length;
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
      <Collapsible
        data-slot="activity"
        disabled={
          state !== "running" &&
          !several &&
          calls.length === 0 &&
          files.length === 0
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
            {calls.length > 0 && <StepList steps={calls} />}
            {files.length > 0 && <SourceList files={files} />}
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
