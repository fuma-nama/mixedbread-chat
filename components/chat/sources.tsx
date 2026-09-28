import { cn } from "cn";
import { badgeVariants } from "@/components/ui/badge";
import { sourceOrigin, sourceTitle } from "./citation";
import type { Citations } from "./markdown";

/** The sources a message cited, numbered like its inline citations. */
export function Sources({ citations }: { citations: Citations }) {
  if (citations.size === 0) return null;

  return (
    <ol aria-label="Sources" className="flex flex-wrap gap-1.5">
      {Array.from(citations.values(), ({ number, source }) => {
        const content = (
          <>
            <span className="text-muted-foreground tabular-nums">{number}</span>
            <span className="max-w-48 truncate">
              {source.type === "url" ? sourceOrigin(source) : source.filename}
            </span>
          </>
        );
        const className = cn(
          badgeVariants({ variant: "outline" }),
          "h-6 gap-1.5 px-2 font-normal",
        );

        return (
          <li key={source.label}>
            {source.type === "url" ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                title={sourceTitle(source)}
                className={className}
              >
                {content}
              </a>
            ) : (
              <span title={sourceTitle(source)} className={className}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
