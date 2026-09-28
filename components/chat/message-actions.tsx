"use client";

import { cn } from "cn";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Copy, edit or retry a message, and flip between its versions. */
export function MessageActions({
  from,
  text,
  versions,
  current,
  onSwitch,
  onEdit,
  onRetry,
}: {
  from: "system" | "user" | "assistant";
  text: string;
  /** IDs of this message and its edits or retries, oldest first. */
  versions: string[];
  current: string;
  onSwitch?: (id: string) => void;
  onEdit?: () => void;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const index = versions.indexOf(current);

  return (
    <div
      className={cn(
        "-mt-2 flex items-center text-muted-foreground",
        from === "user" &&
          "opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100",
      )}
    >
      {versions.length > 1 && (
        <div className="flex items-center tabular-nums">
          <Action
            label="Previous version"
            disabled={!onSwitch || index === 0}
            onClick={() => onSwitch?.(versions[index - 1])}
          >
            <ChevronLeftIcon />
          </Action>
          <span className="text-xs">
            {index + 1}/{versions.length}
          </span>
          <Action
            label="Next version"
            disabled={!onSwitch || index === versions.length - 1}
            onClick={() => onSwitch?.(versions[index + 1])}
          >
            <ChevronRightIcon />
          </Action>
        </div>
      )}
      <Action
        label={copied ? "Copied" : "Copy"}
        onClick={() =>
          void navigator.clipboard.writeText(text).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => setCopied(false),
          )
        }
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Action>
      {onEdit && (
        <Action label="Edit" onClick={onEdit}>
          <PencilIcon />
        </Action>
      )}
      {onRetry && (
        <Action label="Try again" onClick={onRetry}>
          <RefreshCwIcon />
        </Action>
      )}
    </div>
  );
}

function Action({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
