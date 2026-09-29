"use client";

import { cn } from "cn";
import { memo, useRef, useState } from "react";
import { Proofing } from "@/components/brand/bakery";
import { type Citations, copyTextOf, textOf } from "@/lib/messages";
import type { ChatMessage } from "@/lib/search-tool";
import { CitationHighlight } from "./citation";
import { LazyMarkdown } from "./lazy-markdown";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { Reasoning } from "./reasoning";
import { Search, type SearchPart } from "./search";
import { Sources } from "./sources";

/** How a message enters: sent just now it rises, shown by a version switch it fades. */
export type Appear = "rise" | "fade" | undefined;

/**
 * A message with its actions. Its props stay the same while another message
 * streams, so it renders again only when it changes itself.
 */
export const MessageView = memo(function MessageView({
  message,
  citations,
  appear,
  live,
  stopped,
  version,
  versions,
  pinned,
  retryLabel,
  onEdit,
  onRetry,
  onSwitch,
}: {
  message: ChatMessage;
  citations: Citations;
  appear: Appear;
  /** Still streaming. */
  live: boolean;
  stopped: boolean;
  /** Where this message is among its edits or retries, oldest first, and how many there are. */
  version: number;
  versions: number;
  pinned: boolean;
  retryLabel?: string;
  /** Left out, like the other actions, while an answer streams or in someone else's chat. */
  onEdit?: (messageId: string, text: string) => void;
  onRetry?: (messageId: string) => void;
  onSwitch?: (messageId: string, step: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = message.role === "user";
  const searches: SearchPart[] = [];
  for (const part of message.parts) {
    if (part.type === "tool-search") searches.push(part);
  }

  if (editing) {
    return (
      <Message from={message.role} data-message-id={message.id}>
        <MessageEditor
          defaultValue={textOf(message)}
          onCancel={() => {
            setEditing(false);
            // Back to the pencil that opened the editor.
            requestAnimationFrame(() =>
              ref.current
                ?.querySelector<HTMLElement>("[data-action=edit]")
                ?.focus(),
            );
          }}
          onSubmit={(text) => {
            setEditing(false);
            onEdit?.(message.id, text);
          }}
        />
      </Message>
    );
  }

  return (
    <CitationHighlight>
      <Message
        ref={ref}
        from={message.role}
        data-message-id={message.id}
        fresh={appear === "rise"}
        aria-busy={live || undefined}
      >
        <div
          key={message.id}
          data-slot="parts"
          className={cn(
            // Steps stack as one trace; the answer keeps its distance from it.
            "flex w-full flex-col empty:hidden [&>*+*]:mt-4 [&>[data-slot=activity]+[data-slot=activity]]:mt-1",
            user && "items-end",
            appear === "fade" &&
              "motion-safe:animate-[fade_180ms_ease-out_both]",
          )}
        >
          {/* Parts only ever append, and text and reasoning have no id. */}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return user ? (
                  <div
                    key={index}
                    className="max-w-[85%] rounded-[20px] bg-secondary px-4 py-2.5 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground"
                  >
                    {part.text}
                  </div>
                ) : (
                  <LazyMarkdown
                    key={index}
                    deferred={appear !== undefined}
                    citations={citations}
                    isAnimating={live}
                  >
                    {part.text}
                  </LazyMarkdown>
                );
              case "reasoning":
                return (
                  <Reasoning
                    key={index}
                    text={part.text}
                    live={live && part.state === "streaming"}
                    deferred={appear !== undefined}
                  />
                );
              case "tool-search":
                // Every search reads as one trace, where the first one began.
                return (
                  part === searches[0] && (
                    <Search key="search" parts={searches} live={live} />
                  )
                );
              default:
                return null;
            }
          })}
        </div>
        {live && quiet(message) && <Pending />}
        {stopped && (
          <p className="text-[12.5px] text-muted-foreground">Stopped</p>
        )}
        {!live && (
          <>
            <Sources citations={citations} animate={appear === "rise"} />
            <MessageActions
              from={message.role}
              copyText={
                textOf(message).trim()
                  ? () => copyTextOf(message, citations)
                  : undefined
              }
              version={version}
              versions={versions}
              pinned={pinned}
              retryLabel={retryLabel}
              onSwitch={onSwitch && ((step) => onSwitch(message.id, step))}
              onEdit={user && onEdit ? () => setEditing(true) : undefined}
              onRetry={!user && onRetry ? () => onRetry(message.id) : undefined}
              // Once an answer lands, its actions follow the sources in.
              className={
                appear === "rise"
                  ? "motion-safe:animate-[fade_320ms_var(--ease-smooth)_140ms_backwards]"
                  : undefined
              }
            />
          </>
        )}
      </Message>
    </CitationHighlight>
  );
});

function Message({
  from,
  fresh,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  from: "system" | "user" | "assistant";
  /** Arrived during this visit, so it rises into place. */
  fresh?: boolean;
}) {
  return (
    <div
      data-role={from}
      className={cn(
        "group/message flex w-full flex-col gap-3 first:mt-0",
        // An answer sits close to its question; a new question starts a new turn.
        from === "user" ? "relative mt-10 items-end" : "mt-8",
        fresh && "motion-safe:animate-rise",
        className,
      )}
      {...props}
    />
  );
}

/** Waiting on the model: shown a beat late, so quick answers never flash it. */
function Pending() {
  return (
    <div className="flex h-6 w-5 items-center justify-center motion-safe:animate-[fade_240ms_150ms_both] [[data-slot=parts]:has(>[data-slot=activity]:last-child)+&]:-mt-2">
      <Proofing live />
    </div>
  );
}

/**
 * Streaming, with nothing arriving where the reader is: before the first
 * part, between steps, or while a search works in the trace above the text.
 */
function quiet(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;
  let last: ChatMessage["parts"][number] | undefined;
  let searched = false;
  let below = false;
  let searching = false;
  for (const part of message.parts) {
    if (part.type === "tool-search") {
      searched = true;
      searching ||=
        part.state !== "output-error" &&
        (part.state !== "output-available" || part.output.status !== "done");
    } else if (part.type === "text" || part.type === "reasoning") {
      below ||= searched;
    } else continue;
    last = part;
  }
  if (!last) return true;
  if (last.type === "text") return last.text.length === 0;
  if (last.type === "reasoning") return last.state === "done";
  return below || !searching;
}
