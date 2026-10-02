"use client";

import { cn } from "cn";
import { useSetAtom } from "jotai";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pill } from "@/components/ui/popup";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGlide } from "@/hooks/use-glide";
import { type Reasoning, reasoningLevels } from "@/lib/reasoning";
import { remember } from "@/lib/remember";
import { reasoningAtom, useModel } from "./picks";

export function ReasoningPicker() {
  const { current, effort } = useModel();
  const setReasoning = useSetAtom(reasoningAtom);
  const efforts = current?.efforts;
  const [open, setOpen] = useState(false);
  const hidden = !efforts?.length;
  // Folding away, it keeps the level it had rather than turning to Auto.
  const [shown, setShown] = useState(effort);
  if (!hidden && shown !== effort) setShown(effort);
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
          {/* It would cover the open menu. */}
          <Tooltip disabled={open}>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  aria-label={`Thinking effort: ${level.name}`}
                  className={cn(
                    pill,
                    "group/reasoning flex h-8 items-center gap-1.5 px-2",
                  )}
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
              value={effort}
              onValueChange={(id: Reasoning) => {
                remember("reasoning", id);
                setReasoning(id);
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

// The words share one cell, so neither runs past the gliding width.
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

// A 270° arc, as on a toaster's browning dial.
const ARC = "M3.93 12.97A5.75 5.75 0 1 1 12.07 12.97";

// Even steps round the arc, so a level sits in the same place for any model.
const settings: Record<Reasoning, [turn: number, heat: string]> = {
  auto: [0.5, "var(--honey)"],
  none: [0, "var(--honey)"],
  minimal: [0.2, "color-mix(in oklch, var(--crust) 20%, var(--honey))"],
  low: [0.4, "color-mix(in oklch, var(--crust) 45%, var(--honey))"],
  medium: [0.6, "color-mix(in oklch, var(--crust) 75%, var(--honey))"],
  high: [0.8, "var(--crust)"],
  xhigh: [
    1,
    "oklch(from var(--crust) calc(l - 0.08) calc(c + 0.04) calc(h - 10))",
  ],
};

function Dial({ level }: { level: Reasoning }) {
  const [turn, heat] = settings[level];
  const auto = level === "auto";
  // A round cap would paint a dot even with nothing to fill.
  const filled = !auto && turn > 0;

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="size-4 overflow-visible"
    >
      <path
        d={ARC}
        pathLength={10}
        strokeDasharray="0 1"
        className={cn(
          "stroke-current transition-opacity duration-300 motion-reduce:transition-none",
          auto ? "opacity-55" : "opacity-0",
        )}
      />
      <path
        d={ARC}
        className={cn(
          "stroke-current transition-opacity duration-300 motion-reduce:transition-none",
          auto ? "opacity-0" : "opacity-22",
        )}
      />
      <path
        d={ARC}
        pathLength={1}
        strokeDasharray="1 1"
        style={{ strokeDashoffset: filled ? 1 - turn : 1, stroke: heat }}
        className={cn(
          "transition-[stroke-dashoffset,stroke,opacity] duration-500 ease-smooth motion-reduce:transition-none",
          !filled && "opacity-0",
        )}
      />
      <g
        style={
          {
            "--turn": `${-135 + 270 * turn}deg`,
            // Away from the end stop, so Extra high twitches back.
            "--twitch": turn === 1 ? "-9deg" : "9deg",
          } as React.CSSProperties
        }
        className="origin-[8px_8.9px] [rotate:var(--turn)] transition-[rotate] duration-600 ease-spring group-hover/reasoning:[rotate:calc(var(--turn)_+_var(--twitch))] motion-reduce:transition-none"
      >
        <line x1="8" y1="8.9" x2="8" y2="5.2" className="stroke-current" />
        <circle cx="8" cy="8.9" r="1.4" className="fill-current" />
      </g>
    </svg>
  );
}
