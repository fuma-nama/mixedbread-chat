"use client";

import { cn } from "cn";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import type { HostedCall } from "@/lib/mixedbread/research";
import type { ChatMessage } from "@/lib/search-tool";

type SearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-search" }
>;

/** A search tool call: its steps stream in while Toast runs, then fold away. */
export function Search({ part }: { part: SearchPart }) {
  const [open, setOpen] = useState<boolean>();

  if (part.state === "output-error") {
    return (
      <p className="flex items-center gap-2 text-destructive text-sm">
        <XIcon className="size-4" />
        Search failed: {part.errorText}
      </p>
    );
  }

  const output = part.state === "output-available" ? part.output : undefined;
  const done = output?.status === "done";
  const calls = output?.calls ?? [];

  return (
    <Collapsible
      open={open ?? !done}
      onOpenChange={setOpen}
      className="text-muted-foreground text-sm"
    >
      <CollapsibleTrigger className="group/trigger flex max-w-full items-center gap-2 transition-colors hover:text-foreground">
        {done ? <SearchIcon className="size-4 shrink-0" /> : <Spinner />}
        <span className="truncate">
          {done
            ? `Found ${output.sources.length} ${output.sources.length === 1 ? "source" : "sources"}`
            : `Searching ${part.input?.query ?? ""}`}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-panel-open/trigger:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 flex flex-col gap-1.5 border-l pl-4">
          {calls.map((call) => (
            <li
              key={call.id}
              className={cn(
                "flex items-center gap-2",
                call.status === "failed" && "text-destructive",
              )}
            >
              {call.status === "in_progress" && <Spinner className="size-3" />}
              <span className="truncate">{describe(call)}</span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

const list = new Intl.ListFormat("en");

function describe(call: HostedCall): string {
  switch (call.type) {
    case "search_corpus_call":
      return `Searched ${list.format(call.queries ?? [])}`;
    case "grep_call":
      return `Matched ${call.pattern ?? "a pattern"}`;
    case "filter_chunks_call":
      return "Filtered by metadata";
    case "inspect_metadata_call":
      return "Checked the metadata";
    case "get_chunks_call":
      return `Reread ${call.chunk_ids?.length ?? 0} passages`;
    default:
      return call.type;
  }
}
