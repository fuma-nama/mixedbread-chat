"use client";

import { cn } from "cn";
import { useSyncExternalStore } from "react";

/** A key, or a few in a row: `<Kbd>⌘</Kbd><Kbd>K</Kbd>`. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-soft px-1 font-sans text-[11px] font-medium text-muted-foreground tabular-nums select-none in-data-[slot=tooltip-content]:bg-background/15 in-data-[slot=tooltip-content]:text-background/75",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

const subscribe = () => () => {};
const apple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);
const server = () => true;

/** ⌘ on Apple devices, Ctrl elsewhere. Renders ⌘ until hydrated. */
function ModKey() {
  return (
    <Kbd>{useSyncExternalStore(subscribe, apple, server) ? "⌘" : "Ctrl"}</Kbd>
  );
}

export { Kbd, KbdGroup, ModKey };
