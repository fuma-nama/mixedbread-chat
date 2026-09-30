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
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconSwap } from "@/components/ui/icon-swap";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Copy, edit or retry a message, and flip between its versions. */
export function MessageActions({
  from,
  copyText,
  version,
  versions,
  pinned,
  retryLabel,
  onSwitch,
  onEdit,
  onRetry,
  className,
}: {
  from: "system" | "user" | "assistant";
  /** What Copy puts on the clipboard; there is no Copy without it. */
  copyText?: () => string;
  version: number;
  versions: number;
  /** Shown without hovering, as the latest answer is. Touch screens show them all. */
  pinned: boolean;
  retryLabel?: string;
  onSwitch?: (step: -1 | 1) => void;
  onEdit?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  const actions = (
    <div
      className={cn(
        "flex items-center transition-opacity duration-200",
        // Hidden actions stay out of the way of clicks until the message is hovered.
        !pinned &&
          "pointer-events-none opacity-0 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
      )}
    >
      {copyText && (
        <CopyAction
          label="Copy"
          copy={() => navigator.clipboard.writeText(copyText())}
        />
      )}
      {onEdit && (
        <Action label="Edit" data-action="edit" onClick={onEdit}>
          <PencilIcon />
        </Action>
      )}
      {onRetry && (
        <Action label={retryLabel ?? "Try again"} onClick={onRetry}>
          <RefreshCwIcon />
        </Action>
      )}
    </div>
  );

  const switcher = onSwitch && versions > 1 && (
    <Versions version={version} versions={versions} onSwitch={onSwitch} />
  );

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-muted-foreground",
        // A question's actions float in the gap below it instead of widening it.
        from === "user"
          ? "absolute top-full right-0 -mr-1.5 pt-0.5"
          : "-my-1 -ml-1.5",
        className,
      )}
    >
      {/* The switcher stays put at the message's edge; actions come and go beside it. */}
      {from === "user" ? (
        <>
          {actions}
          {switcher}
        </>
      ) : (
        <>
          {switcher}
          {actions}
        </>
      )}
    </div>
  );
}

function Versions({
  version,
  versions,
  onSwitch,
}: {
  version: number;
  versions: number;
  onSwitch: (step: -1 | 1) => void;
}) {
  // Which way the count slides: towards the version just picked.
  const [step, setStep] = useState<-1 | 1>();

  function go(next: -1 | 1) {
    setStep(next);
    onSwitch(next);
  }

  return (
    <div className="flex items-center font-mono text-[11.5px] tabular-nums">
      <Action
        label="Previous version"
        disabled={version === 0}
        onClick={() => go(-1)}
      >
        <ChevronLeftIcon />
      </Action>
      <span
        key={version}
        aria-live="polite"
        className={cn(
          "min-w-7 text-center",
          step === -1 && "motion-safe:animate-count-back",
          step === 1 && "motion-safe:animate-count-forward",
        )}
      >
        {version + 1}/{versions}
      </span>
      <Action
        label="Next version"
        disabled={version === versions - 1}
        onClick={() => go(1)}
      >
        <ChevronRightIcon />
      </Action>
    </div>
  );
}

/** A small icon button with its name in a tooltip. */
export function Action({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="text-muted-foreground hover:text-foreground"
            {...props}
          />
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Copies, then shows a check for a moment. */
export function CopyAction({
  label,
  copy,
}: {
  label: string;
  copy: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <Action
      label={copied ? "Copied" : label}
      onClick={() =>
        void copy().then(
          () => {
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1600);
          },
          () => setCopied(false),
        )
      }
    >
      <IconSwap swapped={copied} from={<CopyIcon />} to={<CheckIcon />} />
    </Action>
  );
}
