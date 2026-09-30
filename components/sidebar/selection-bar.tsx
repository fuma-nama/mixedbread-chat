"use client";

import { cn } from "cn";
import { TrashIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// The two trade one place, the new one rising in as the old one sinks away.
const layer =
  "col-start-1 row-start-1 transition-[opacity,translate] duration-200 ease-smooth motion-reduce:transition-none";
const away = "translate-y-1 opacity-0";

/** Takes the place of `children` while chats are selected; the count holds as the bar fades out. */
export function SelectionBar({
  count,
  onClear,
  onDelete,
  children,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState({ count, roll: 1 });
  if (count && count !== shown.count) {
    setShown({ count, roll: count > shown.count ? 1 : -1 });
  }

  return (
    <div className="grid shrink-0 p-2">
      <div inert={count > 0} className={cn(layer, count > 0 && away)}>
        {children}
      </div>
      <div
        inert={!count}
        className={cn(layer, "flex h-10 items-center gap-0.5", !count && away)}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear selection"
                className="text-muted-foreground"
                onClick={onClear}
              />
            }
          >
            <XIcon />
          </TooltipTrigger>
          <TooltipContent>
            Clear selection
            <Kbd>Esc</Kbd>
          </TooltipContent>
        </Tooltip>
        <span className="min-w-0 flex-1 truncate text-[13.5px] tabular-nums">
          <span
            key={shown.count}
            style={{ "--roll": shown.roll } as React.CSSProperties}
            className="inline-block motion-safe:animate-roll-in"
          >
            {shown.count}
          </span>{" "}
          selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-keyshortcuts="Delete"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <TrashIcon />
          Delete
        </Button>
      </div>
      <p role="status" className="sr-only">
        {count ? `${count} selected` : ""}
      </p>
    </div>
  );
}
