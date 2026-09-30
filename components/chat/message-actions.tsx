"use client";

import { cn } from "cn";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconSwap } from "@/components/ui/icon-swap";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Versions({
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
