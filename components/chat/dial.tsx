import { cn } from "cn";
import type { Reasoning } from "@/lib/reasoning";

// A toaster's browning dial: a 270° arc, turned further and toasted darker the
// harder the model thinks. Auto points straight up over a dotted track.
const ARC = "M3.93 12.97A5.75 5.75 0 1 1 12.07 12.97";

// Even steps round the arc, so a level sits in the same place for any model.
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

export function Dial({ level }: { level: Reasoning }) {
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
