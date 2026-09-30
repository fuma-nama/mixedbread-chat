"use client";

import { cn } from "cn";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGlide } from "@/hooks/use-glide";
import {
  type Effort,
  isReasoning,
  type Reasoning,
  reasoningLevels,
} from "@/lib/reasoning";
import { Dial } from "./dial";

/**
 * Picks how hard the model thinks; the choice is kept for the next visit.
 * For a model that takes no effort it folds away, and unfolds again for one
 * that does.
 */
export function ReasoningPicker({
  value,
  efforts,
  onChange,
}: {
  value: Reasoning;
  /** The model's efforts, listed after Auto. */
  efforts?: Effort[];
  onChange: (reasoning: Reasoning) => void;
}) {
  const [open, setOpen] = useState(false);
  const hidden = !efforts?.length;
  // Folding away, it keeps the level it had rather than turning to Auto.
  const [shown, setShown] = useState(value);
  if (!hidden && shown !== value) setShown(value);
  const rank = reasoningLevels.findIndex((level) => level.id === shown);
  const level = reasoningLevels[rank];

  return (
    <div
      inert={hidden}
      className={cn(
        "grid transition-[grid-template-columns,opacity] duration-240 ease-smooth motion-reduce:transition-none",
        hidden ? "grid-cols-[0fr] opacity-0" : "grid-cols-[1fr]",
      )}
    >
      {/* Clipped only while folded, so the focus ring shows in full. */}
      <div className={cn("min-w-0", hidden && "overflow-hidden")}>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          {/* It would cover the open menu, so it waits for the menu to close. */}
          <Tooltip disabled={open}>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  aria-label={`Thinking effort: ${level.name}`}
                  className="group/reasoning flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[13px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft hover:text-foreground focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground"
                />
              }
            >
              <Dial level={shown} />
              <Rolling text={level.name} rank={rank} />
            </TooltipTrigger>
            <TooltipContent>Thinking effort</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="top" sideOffset={8}>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(id) => {
                if (!isReasoning(id)) return;
                // Read by the server to preselect the level on the next visit.
                void cookieStore.set({
                  name: "reasoning",
                  value: id,
                  expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
                });
                onChange(id);
              }}
            >
              <DropdownMenuLabel>Thinking effort</DropdownMenuLabel>
              {reasoningLevels.map(
                (level) =>
                  (level.id === "auto" || efforts?.includes(level.id)) && (
                    <DropdownMenuRadioItem
                      key={level.id}
                      value={level.id}
                      closeOnClick
                    >
                      <Dial level={level.id} />
                      {level.name}
                    </DropdownMenuRadioItem>
                  ),
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * The level's name. On a change the old word rolls out as the new one rolls
 * in, the way the dial turned, and the width glides between them. The words
 * share one cell, so the width holds the old one until it leaves, and the
 * new one waits for the width to all but land: neither runs past the edge.
 */
function Rolling({ text, rank }: { text: string; rank: number }) {
  const ref = useGlide<HTMLSpanElement>("width", 360);
  const [roll, setRoll] = useState<{
    text: string;
    rank: number;
    previous?: string;
    direction?: 1 | -1;
  }>({ text, rank });
  if (text !== roll.text) {
    setRoll({
      text,
      rank,
      previous: roll.text,
      direction: rank > roll.rank ? 1 : -1,
    });
  }

  return (
    <span
      ref={ref}
      style={{ "--roll": roll.direction } as React.CSSProperties}
      className="inline-grid justify-items-start whitespace-nowrap *:[grid-area:1/1]"
    >
      {roll.previous && (
        <span
          key={roll.previous}
          aria-hidden="true"
          className="motion-safe:animate-roll-out motion-reduce:hidden"
          onAnimationEnd={() =>
            setRoll((roll) => ({ ...roll, previous: undefined }))
          }
        >
          {roll.previous}
        </span>
      )}
      <span
        key={roll.text}
        className={
          roll.direction &&
          "motion-safe:[animation:var(--animate-roll-in)_140ms]"
        }
      >
        {roll.text}
      </span>
    </span>
  );
}
