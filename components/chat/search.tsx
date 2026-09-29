"use client";

import { cn } from "cn";
import { GlobeIcon, LayersIcon } from "lucide-react";
import { Toasting } from "@/components/brand/bakery";
import { SliceGlyph } from "@/components/brand/slice";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { type Source, sourceTitle } from "@/lib/mixedbread/citations";
import type { Step } from "@/lib/mixedbread/research";
import type { ChatMessage, SearchOutput } from "@/lib/search-tool";
import {
  ActivityPanel,
  ActivityTrigger,
  formatSeconds,
  LiveLine,
  StatusDot,
  useElapsed,
} from "./activity";
import { originOf } from "./citation";

type SearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-search" }
>;

type Done = Extract<SearchOutput, { status: "done" }>;

/**
 * A Toast run. While it searches, a slice toasts and one line follows its
 * newest step; once done, the toast pops up and the whole trace folds away
 * behind the summary. A search over several sources at once runs one Toast
 * per source side by side, so each gets its own line and its own section.
 */
export function Search({
  part,
  live,
}: {
  part: SearchPart;
  /** Its message is still streaming; otherwise an unfinished search was stopped. */
  live: boolean;
}) {
  const output = part.state === "output-available" ? part.output : undefined;
  const done = output?.status === "done" ? output : undefined;
  const state =
    part.state === "output-error"
      ? "failed"
      : done
        ? "done"
        : live
          ? "running"
          : "stopped";
  const steps = output?.calls ?? [];
  const groups = groupsOf(steps);
  const elapsed = useElapsed(state === "running");

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
        detail={part.input?.query && `“${part.input.query}”`}
        meta={
          state === "running" || done
            ? summary(steps, done, elapsed)
            : undefined
        }
      />
      {state === "running" &&
        (groups.size > 1 ? (
          <Lanes groups={groups} />
        ) : (
          <LiveLine text={latest(steps)} />
        ))}
      <CollapsibleContent hiddenUntilFound>
        <ActivityPanel>
          {part.state === "output-error" && (
            <p className="text-[12.5px] text-muted-foreground">
              {part.errorText}
            </p>
          )}
          {groups.size > 1 ? (
            <ol className="flex flex-col gap-3">
              {Array.from(groups, ([name, steps]) => (
                <Group key={name} name={name} steps={steps} />
              ))}
            </ol>
          ) : (
            steps.length > 0 && <Steps steps={steps} />
          )}
          {done && done.sources.length > 0 && (
            <ol aria-label="Sources found" className="flex flex-col">
              {done.sources.map((source, index) => (
                <SourceRow key={source.label} source={source} index={index} />
              ))}
            </ol>
          )}
        </ActivityPanel>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Its steps and time while it runs; what it found and how long it took once done. */
function summary(
  steps: Step[],
  done: Done | undefined,
  elapsed: number | undefined,
): string | undefined {
  const seconds = done ? done.ms / 1000 : elapsed;
  const time =
    seconds && (done || seconds >= 3) ? formatSeconds(seconds) : undefined;
  // Toast can answer from what it read without citing any of it.
  const what = done
    ? done.sources.length > 0
      ? plural(done.sources.length, "source")
      : done.read > 0
        ? `${plural(done.read, "result")}, none cited`
        : "Nothing found"
    : steps.length > 0
      ? plural(steps.length, "step")
      : undefined;
  return what && time ? `${what} · ${time}` : (what ?? time);
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** Steps by the run they came from, in the order the runs first spoke up. */
function groupsOf(steps: Step[]): Map<string, Step[]> {
  const groups = new Map<string, Step[]>();
  for (const step of steps) {
    const name = step.group ?? "";
    const group = groups.get(name);
    if (group) group.push(step);
    else groups.set(name, [step]);
  }
  return groups;
}

/**
 * While runs go side by side, one line each: its state, its name, and its
 * newest step, replaced in place as it goes.
 */
function Lanes({ groups }: { groups: Map<string, Step[]> }) {
  return (
    <ul className="mt-0.5 ml-7 flex flex-col text-[12.5px] text-muted-foreground/80">
      {Array.from(groups, ([name, steps]) => {
        const text = latest(steps, true);
        return (
          <li
            key={name}
            className="flex h-5 min-w-0 items-center gap-2 motion-safe:animate-swap-in"
          >
            <StatusDot
              state={
                steps.some((step) => step.status === "running")
                  ? "running"
                  : steps.every((step) => step.status === "failed")
                    ? "failed"
                    : "done"
              }
            />
            <span className="max-w-[45%] shrink-0 truncate text-foreground/75">
              {name}
            </span>
            <span key={text} className="truncate motion-safe:animate-swap-in">
              {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
        <span className="ml-auto shrink-0 pl-1 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
          {plural(steps.length, "step")}
        </span>
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
  const failed = step.status === "failed";
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
        {failed && <span className="shrink-0 text-destructive">· failed</span>}
      </div>
      {/* Under the text, clear of the dot. */}
      {filters && (
        <p className="truncate pl-3.5 font-mono text-[11.5px] text-muted-foreground/80">
          where {filters}
        </p>
      )}
      {failed && step.error && (
        <p className="pl-3.5 text-[12px] text-pretty text-destructive/85">
          {step.error}
        </p>
      )}
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
      <span className="ml-auto max-w-[45%] shrink-0 truncate pl-3 font-mono text-[11px] text-muted-foreground/80">
        {originOf(source)}
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
