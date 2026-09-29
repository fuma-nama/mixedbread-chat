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
import {
  type Effort,
  isReasoning,
  type Reasoning,
  reasoningLevels,
} from "@/lib/reasoning";

/**
 * Picks how hard the model thinks; the choice is kept for the next visit.
 * For a model that takes no effort it folds away, and unfolds again for one
 * that does.
 */
export const ReasoningPicker = memo(function ReasoningPicker({
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
});

/*
 * A toaster's browning dial: a 270° arc open at the bottom, turned further
 * and toasted darker the harder the model thinks. Auto points straight up
 * over a dotted track, as the model sets it rather than you.
 */
const ARC = "M3.93 12.97A5.75 5.75 0 1 1 12.07 12.97";

// Off to Extra high in even steps round the arc, each a shade more toasted,
// so a level sits in the same place whichever model offers it.
const settings: Record<Reasoning, { turn: number; heat: string }> = {
  auto: { turn: 0.5, heat: "var(--honey)" },
  none: { turn: 0, heat: "var(--honey)" },
  minimal: {
    turn: 0.2,
    heat: "color-mix(in oklch, var(--crust) 20%, var(--honey))",
  },
  low: {
    turn: 0.4,
    heat: "color-mix(in oklch, var(--crust) 45%, var(--honey))",
  },
  medium: {
    turn: 0.6,
    heat: "color-mix(in oklch, var(--crust) 75%, var(--honey))",
  },
  high: { turn: 0.8, heat: "var(--crust)" },
  xhigh: {
    turn: 1,
    heat: "oklch(from var(--crust) calc(l - 0.08) calc(c + 0.04) calc(h - 10))",
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
  // Off has nothing to fill; a round cap would still paint a dot at the start.
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
