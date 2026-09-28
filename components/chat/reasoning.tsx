"use client";

import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** The model's reasoning, folded like ChatGPT's "Thought" block. */
export function Reasoning({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  if (!text && !streaming) return null;

  return (
    <Collapsible className="text-muted-foreground text-sm">
      <CollapsibleTrigger className="group/trigger flex items-center gap-1 transition-colors hover:text-foreground">
        <span className={cn(streaming && "animate-pulse")}>
          {streaming ? "Thinking" : "Thought"}
        </span>
        <ChevronDownIcon className="size-4 transition-transform group-data-panel-open/trigger:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 whitespace-pre-wrap border-l pl-4">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
