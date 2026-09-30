"use client";

import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { CollapsibleTrigger } from "@/components/ui/collapsible";

export function ActivityTrigger({
  indicator,
  label,
  detail,
  meta,
}: {
  indicator: React.ReactNode;
  label: React.ReactNode;
  detail?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <CollapsibleTrigger className="group/trigger -ml-1 flex max-w-full cursor-pointer items-center gap-2 rounded-md py-0.5 pr-1.5 pl-1 text-left text-[13.5px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 not-data-disabled:hover:text-foreground focus-visible:outline-2 data-disabled:cursor-default">
      <span className="flex w-5 shrink-0 justify-center">{indicator}</span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0">{label}</span>
        {detail && (
          <span className="truncate text-muted-foreground/75">{detail}</span>
        )}
        {meta && (
          <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground/70 tabular-nums empty:hidden">
            {meta}
          </span>
        )}
      </span>
      <ChevronRightIcon className="size-3.5 shrink-0 opacity-50 transition-transform duration-300 ease-smooth group-data-disabled/trigger:hidden group-data-panel-open/trigger:rotate-90 motion-reduce:transition-none" />
    </CollapsibleTrigger>
  );
}

export function StatusDot({
  state,
}: {
  state: "running" | "done" | "failed" | "stopped";
}) {
  return (
    <span
      key={state}
      aria-hidden="true"
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        state === "running" && "bg-crust motion-safe:animate-breathe",
        state === "done" && "bg-muted-foreground/45 motion-safe:animate-pop",
        state === "failed" && "bg-destructive motion-safe:animate-pop",
        state === "stopped" && "bg-muted-foreground/30",
      )}
    />
  );
}

export function LiveLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="mt-0.5 ml-7 h-5 overflow-hidden text-[12.5px] text-muted-foreground/80">
      <p key={text} className="truncate motion-safe:animate-swap-in">
        {text}
      </p>
    </div>
  );
}

export function ActivityPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 ml-[9.5px] flex flex-col gap-3 border-l border-soft pb-1 pl-[17.5px]">
      {children}
    </div>
  );
}

/**
 * The first `count` items, and how many more wait until they are asked for.
 * `showAll` is for a button right after the list: as the button goes, focus
 * moves to the first new item that takes it, or else to the list.
 */
export function useFirst<T>(items: T[], count: number) {
  const [all, setAll] = useState(false);
  const more = all ? 0 : items.length - count;
  return {
    shown: more > 0 ? items.slice(0, count) : items,
    more,
    showAll(event: React.MouseEvent<HTMLElement>) {
      const list = event.currentTarget.previousElementSibling as HTMLElement;
      flushSync(() => setAll(true));
      const item = list.children[count] as HTMLElement | undefined;
      const focusable = "a[href], button";
      (item?.matches(focusable)
        ? item
        : (item?.querySelector<HTMLElement>(focusable) ?? list)
      ).focus();
    },
  };
}

export function More({
  count,
  onClick,
}: {
  count: number;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
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

export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

// One clock for every running step, ticking only while one is.
const clock = { now: 0, listeners: new Set<() => void>() };
let ticker: ReturnType<typeof setInterval> | undefined;

function tick() {
  clock.now = Date.now();
  for (const listener of clock.listeners) listener();
}

function subscribeClock(listener: () => void) {
  if (clock.listeners.size === 0) {
    clock.now = Date.now();
    ticker = setInterval(tick, 500);
  }
  clock.listeners.add(listener);
  return () => {
    clock.listeners.delete(listener);
    if (clock.listeners.size === 0) clearInterval(ticker);
  };
}

const still = () => () => {};
const now = () => clock.now;

/** Seconds since `running` turned on; a step loaded from history has none. */
export function useElapsed(running: boolean): number | undefined {
  const [start] = useState(() => (running ? Date.now() : undefined));
  const time = useSyncExternalStore(running ? subscribeClock : still, now, now);
  return start === undefined ? undefined : Math.max(0, time - start) / 1000;
}

/** How long `running` stayed on, once it turns off; from history, none. */
export function useDuration(running: boolean): number | undefined {
  const [span, setSpan] = useState(() =>
    running ? { start: Date.now(), end: 0 } : undefined,
  );
  // oxlint-disable-next-line react/purity -- stamped once, as `running` turns off
  if (span && !running && !span.end) setSpan({ ...span, end: Date.now() });
  return span?.end ? (span.end - span.start) / 1000 : undefined;
}

export function formatSeconds(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}
