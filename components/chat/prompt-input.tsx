"use client";

import type { ChatStatus } from "ai";
import { cn } from "cn";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";

export function PromptInput({
  status,
  onSubmit,
  onStop,
  className,
}: {
  status: ChatStatus;
  onSubmit: (text: string) => void;
  onStop: () => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function submit() {
    const value = text.trim();
    if (!value || busy) return;
    onSubmit(value);
    setText("");
  }

  return (
    <form
      className={cn("mx-auto w-full max-w-3xl px-4 pb-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <InputGroup className="rounded-2xl bg-background">
        <InputGroupTextarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything"
          aria-label="Message"
          className="max-h-48 min-h-12 px-4 pt-3"
        />
        <InputGroupAddon align="block-end">
          {busy ? (
            <InputGroupButton
              variant="default"
              size="icon-sm"
              className="ml-auto rounded-full"
              aria-label="Stop"
              onClick={onStop}
            >
              <SquareIcon className="fill-current" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              className="ml-auto rounded-full"
              aria-label="Send"
              disabled={!text.trim()}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
