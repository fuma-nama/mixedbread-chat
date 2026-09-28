"use client";

import { cn } from "cn";
import { ArrowDownIcon } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";

/** Scrollable message list that follows new content until the user scrolls up. */
export function Conversation({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <StickToBottom
      className={cn("relative min-h-0 flex-1", className)}
      initial="smooth"
      resize="smooth"
      role="log"
    >
      <StickToBottom.Content className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        {children}
      </StickToBottom.Content>
      <ScrollToBottom />
    </StickToBottom>
  );
}

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
      aria-label="Scroll to bottom"
      onClick={() => scrollToBottom()}
    >
      <ArrowDownIcon />
    </Button>
  );
}
