"use client";

import { cn } from "cn";
import { FileTextIcon, GlobeIcon } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Source } from "@/lib/mixedbread/citations";

/** An inline citation: the source's number, with the source on hover. */
export function Citation({
  number,
  source,
}: {
  number: number;
  source: Source;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        {...(source.type === "url"
          ? { href: source.url, target: "_blank", rel: "noreferrer" }
          : { render: <button type="button" /> })}
        aria-label={`Source ${number}: ${sourceTitle(source)}`}
        className={cn(
          badgeVariants({ variant: "secondary" }),
          "mx-0.5 h-4.5 min-w-4.5 px-1 align-text-top text-[0.7rem] tabular-nums hover:bg-accent",
        )}
      >
        {number}
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <SourceSummary source={source} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function SourceSummary({ source }: { source: Source }) {
  const Icon = source.type === "url" ? GlobeIcon : FileTextIcon;

  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="line-clamp-2 font-medium">{sourceTitle(source)}</p>
        <p className="truncate text-muted-foreground text-xs">
          {sourceOrigin(source)}
        </p>
      </div>
    </div>
  );
}

export function sourceTitle(source: Source): string {
  return source.type === "url" ? source.title || source.url : source.filename;
}

export function sourceOrigin(source: Source): string {
  return source.type === "url"
    ? new URL(source.url).hostname.replace(/^www\./, "")
    : "Your documents";
}
