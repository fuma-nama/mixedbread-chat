"use client";

import { cn } from "cn";
import { useState } from "react";
import { SLICE_PATH } from "./slice";

// Opaque, so the slice behind the toaster stays hidden in both themes.
const metal =
  "fill-[color-mix(in_oklch,var(--muted-foreground)_55%,var(--panel))]";
const slot =
  "fill-[color-mix(in_oklch,var(--muted-foreground)_25%,var(--panel))]";

export function Toasting({
  state,
}: {
  state: "running" | "done" | "stopped" | "failed";
}) {
  return (
    <svg
      viewBox="0 0 20 18"
      aria-hidden="true"
      data-state={state}
      className="group/toaster h-4.5 w-5 overflow-visible"
    >
      {/* Drawn first, so the toaster's front hides it below the slot. */}
      <g className="translate-y-[4.6px] transition-[translate] duration-500 ease-[cubic-bezier(0.34,1.9,0.64,1)] group-data-[state=done]/toaster:translate-y-0 group-data-[state=running]/toaster:duration-300 group-data-[state=running]/toaster:ease-glide motion-reduce:transition-none">
        <g className="group-data-[state=running]/toaster:motion-safe:animate-toast-bob">
          <path
            d={SLICE_PATH}
            transform="translate(3.8 1.8) scale(0.62)"
            className="fill-current text-honey transition-colors duration-300 group-data-[state=done]/toaster:text-crust group-data-[state=failed]/toaster:text-[oklch(0.42_0.05_40)] group-data-[state=running]/toaster:text-crust group-data-[state=running]/toaster:duration-[6s] group-data-[state=running]/toaster:ease-linear"
          />
        </g>
      </g>
      <rect x="1" y="8.5" width="15.5" height="8" rx="3" className={metal} />
      <rect
        x="3.6"
        y="8.1"
        width="10.3"
        height="1.2"
        rx="0.6"
        className={slot}
      />
      <rect
        x="4.6"
        y="8.1"
        width="8.3"
        height="1.2"
        rx="0.6"
        className="fill-crust opacity-0 transition-opacity duration-300 group-data-[state=running]/toaster:motion-safe:animate-toast-heat"
      />
      <circle cx="13.2" cy="12.9" r="1.15" className={slot} />
      <rect x="3" y="16" width="2.2" height="1.4" rx="0.7" className={metal} />
      <rect
        x="12.3"
        y="16"
        width="2.2"
        height="1.4"
        rx="0.7"
        className={metal}
      />
      <rect
        x="16.9"
        y="10"
        width="2.3"
        height="1.5"
        rx="0.75"
        className={cn(
          metal,
          "transition-[translate] duration-500 ease-spring group-data-[state=running]/toaster:translate-y-[3.4px] group-data-[state=running]/toaster:duration-300 group-data-[state=running]/toaster:ease-glide motion-reduce:transition-none",
        )}
      />
    </svg>
  );
}

type Phase = "live" | "baking" | "baked";

const CRUMBS = [1.6, 1.4, 1.2, 1, 0.85, 0.72, 0.6].map((r, index) => {
  const angle = (-index * 30 * Math.PI) / 180;
  return {
    cx: round(8 + 5 * Math.sin(angle)),
    cy: round(8 - 5 * Math.cos(angle)),
    r,
    opacity: [1, 0.9, 0.75, 0.6, 0.48, 0.36, 0.26][index],
    crust: index < 2,
  };
});

// Honey leaned toward crust, so the tail still reads on a light page.
const crumbFill = "fill-[color-mix(in_oklch,var(--crust)_55%,var(--honey))]";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Moves only on a change, so a thought from history is just the slice. */
export function Proofing({ live }: { live: boolean }) {
  const [phase, setPhase] = useState<Phase>(live ? "live" : "baked");
  if (live && phase !== "live") setPhase("live");
  else if (!live && phase === "live") setPhase("baking");

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      data-phase={phase}
      className="size-4 overflow-visible"
    >
      {phase !== "baked" && (
        <g
          className={cn(
            "origin-[8px_8px]",
            // Without motion, nothing ends the bake: the ring just goes.
            phase === "baking" &&
              "motion-safe:animate-proof-collapse motion-reduce:hidden",
          )}
        >
          {/* A slight tilt, so the ring reads as an orbit rather than a dial. */}
          <g className="origin-[8px_8px] scale-y-90">
            <g className="origin-[8px_8px] motion-safe:animate-proof-breathe">
              <g className="origin-[8px_8px] motion-safe:animate-proof-spin">
                {CRUMBS.map((crumb) => (
                  <circle
                    key={crumb.r}
                    cx={crumb.cx}
                    cy={crumb.cy}
                    r={crumb.r}
                    opacity={crumb.opacity}
                    className={crumb.crust ? "fill-crust" : crumbFill}
                  />
                ))}
              </g>
            </g>
          </g>
        </g>
      )}
      {phase === "baking" && (
        <circle
          cx="8"
          cy="8.4"
          r="6.6"
          className="origin-[8px_8.4px] fill-none stroke-honey stroke-[0.6] opacity-0 motion-safe:animate-proof-puff"
        />
      )}
      {phase !== "live" && (
        <path
          d={SLICE_PATH}
          onAnimationEnd={() => setPhase("baked")}
          className={cn(
            "origin-center fill-crust [transform-box:fill-box]",
            phase === "baking" && "motion-safe:animate-proof-bake",
          )}
        />
      )}
    </svg>
  );
}
