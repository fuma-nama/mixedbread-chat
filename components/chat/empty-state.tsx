"use client";

import { cn } from "cn";
import { HalftoneMark } from "@/components/brand/halftone-mark";
import type { SearchScope } from "@/lib/search-tool";
import { suggestions } from "@/lib/suggestions";

/** The greeting above the composer on a new chat. */
export function EmptyState({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="flex flex-col items-center px-4 text-center">
      <div className="h-24 w-44 sm:h-28 sm:w-52">
        <HalftoneMark />
      </div>
      <h1 className="mt-4 text-[1.75rem] leading-[1.1] font-normal tracking-[-0.025em] text-balance motion-safe:animate-rise motion-safe:[animation-delay:120ms] sm:text-[2.25rem]">
        What do you want to know?
      </h1>
    </div>
  );
}

/** Example questions that send on click. */
export function Suggestions({
  scope,
  onPick,
  className,
}: {
  scope: SearchScope;
  onPick: (question: string) => void;
  className?: string;
}) {
  return (
    <ul
      aria-label="Suggestions"
      className={cn(
        "flex flex-wrap justify-center gap-2 px-4 outline-offset-2 outline-ring focus-visible:outline-2",
        className,
      )}
    >
      {suggestions[scope].map((question, index) => (
        <li
          key={question}
          className="shrink-0 motion-safe:animate-rise"
          style={{ animationDelay: `${240 + index * 50}ms` }}
        >
          <button
            type="button"
            onClick={() => onPick(question)}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap text-muted-foreground ring-1 ring-soft outline-offset-1 outline-ring transition-[color,background-color,box-shadow] duration-150 hover:bg-card hover:text-foreground hover:shadow-raised hover:ring-foreground/15 focus-visible:outline-2"
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  );
}
