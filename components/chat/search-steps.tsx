"use client";

import { cn } from "cn";
import { GlobeIcon, LayersIcon } from "lucide-react";
import type { Step } from "@/lib/mixedbread/research";
import { More, plural, StatusDot, useFirst } from "./activity";

const FIRST_STEPS = 6;

/** Steps by the run they came from, in the order the runs first spoke up. */
export function runsOf(steps: Step[]): Map<string, Step[]> {
  const runs = new Map<string, Step[]>();
  for (const step of steps) {
    const name = step.group ?? "";
    const run = runs.get(name);
    if (run) run.push(step);
    else runs.set(name, [step]);
  }
  return runs;
}

/** The step to show on a live line: the newest one, or what comes next. */
export function latest(steps: Step[], lane = false): string {
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

/** The steps, under each run when several ran side by side. */
export function StepList({ steps }: { steps: Step[] }) {
  const runs = runsOf(steps);
  if (runs.size < 2) return <Steps steps={steps} />;
  return (
    <ol className="flex flex-col gap-3">
      {Array.from(runs, ([name, steps]) => (
        <Group key={name} name={name} steps={steps} />
      ))}
    </ol>
  );
}

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
    case "other":
      return {
        live: "Running",
        done: "Ran",
        detail: step.tool?.replace(/_call$/, ""),
      };
  }
}

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
