"use client";

import { cn } from "cn";
import { useSyncExternalStore } from "react";

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      data-slot="kbd"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-soft px-1 font-sans text-[11px] font-medium text-muted-foreground tabular-nums select-none in-data-[slot=tooltip-content]:bg-background/15 in-data-[slot=tooltip-content]:text-background/75"
    >
      {children}
    </kbd>
  );
}

const subscribe = () => () => {};
const apple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);
const server = () => true;

/** ⌘ on Apple devices, Ctrl elsewhere (⌘ until hydrated), then `keys`. */
export function Shortcut({
  keys,
  className,
}: {
  keys: string[];
  className?: string;
}) {
  const mod = useSyncExternalStore(subscribe, apple, server) ? "⌘" : "Ctrl";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <Kbd>{mod}</Kbd>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}
