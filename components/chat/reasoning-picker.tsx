"use client";

import { cn } from "cn";
import { memo, useState } from "react";
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
import { isReasoning, type Reasoning, reasoningLevels } from "@/lib/reasoning";

/** Picks how hard the model thinks; the choice is kept for the next visit. */
export const ReasoningPicker = memo(function ReasoningPicker({
  value,
  onChange,
}: {
  value: Reasoning;
  onChange: (reasoning: Reasoning) => void;
}) {
  const [open, setOpen] = useState(false);
  const rank = reasoningLevels.findIndex((level) => level.id === value);
  const level = reasoningLevels[rank];

  return (
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
          <Dial level={value} />
          <Rolling text={level.name} rank={rank} />
        </TooltipTrigger>
        <TooltipContent>Thinking effort</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" sideOffset={8} className="w-64">
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
          {reasoningLevels.map((level) => (
            <DropdownMenuRadioItem key={level.id} value={level.id} closeOnClick>
              <Dial level={level.id} />
              <span className="flex flex-col">
                {level.name}
                <span className="text-xs text-muted-foreground">
                  {level.description}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

/*
 * A toaster's browning dial: a 270° arc open at the bottom, turned further
 * and toasted darker the harder the model thinks. Auto points straight up
 * over a dotted track, as the model sets it rather than you.
 */
const ARC = "M3.93 12.97A5.75 5.75 0 1 1 12.07 12.97";

const settings: Record<Reasoning, { turn: number; heat: string }> = {
  auto: { turn: 0.5, heat: "var(--honey)" },
  low: {
    turn: 1 / 3,
    heat: "color-mix(in oklch, var(--crust) 35%, var(--honey))",
  },
  medium: { turn: 2 / 3, heat: "var(--crust)" },
  high: {
    turn: 1,
    heat: "oklch(from var(--crust) calc(l - 0.06) calc(c + 0.03) calc(h - 8))",
  },
};

/**
 * The needle springs to its level, overshooting a little like a knob let go,
 * while the arc fills behind it. On hover it gives a small twitch, a hint
 * that it turns.
 */
function Dial({ level }: { level: Reasoning }) {
  const { turn, heat } = settings[level];
  const auto = level === "auto";

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
        style={{ strokeDashoffset: auto ? 1 : 1 - turn, stroke: heat }}
        className={cn(
          "transition-[stroke-dashoffset,stroke,opacity] duration-500 ease-smooth motion-reduce:transition-none",
          auto && "opacity-0",
        )}
      />
      <g
        style={
          {
            "--turn": `${-135 + 270 * turn}deg`,
            // Away from the end stop, so High twitches back.
            "--twitch": level === "high" ? "-9deg" : "9deg",
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

/**
 * The level's name. On a change the old word rolls out as the new one rolls
 * in, the way the dial turned, and the width between them glides instead of
 * jumping.
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
      className="relative inline-block whitespace-nowrap"
    >
      {roll.previous && (
        <span
          key={roll.previous}
          aria-hidden="true"
          className="absolute top-0 left-0 motion-safe:animate-roll-out motion-reduce:hidden"
          onAnimationEnd={() =>
            setRoll((roll) => ({ ...roll, previous: undefined }))
          }
        >
          {roll.previous}
        </span>
      )}
      <span
        key={roll.text}
        className={cn(
          "inline-block",
          roll.direction && "motion-safe:animate-roll-in",
        )}
      >
        {roll.text}
      </span>
    </span>
  );
}
