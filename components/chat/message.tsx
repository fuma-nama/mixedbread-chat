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
  const traces = tracesOf(message.parts);
  const waiting = live ? pending(message) : undefined;

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
              case "tool-search": {
                const steps = traces.get(index);
                return (
                  steps && (
                    <Search key={part.toolCallId} steps={steps} live={live} />
                  )
                );
              }
              default:
                return null;
            }
          })}
        </div>
        {waiting && <Pending label={waiting} />}
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
function Pending({ label }: { label: string }) {
  return (
    <div className="-ml-1 flex items-center gap-2 py-0.5 pl-1 text-[13.5px] motion-safe:animate-[fade_240ms_150ms_both] [[data-slot=parts]:has(>[data-slot=activity]:last-child)+&]:-mt-2">
      <span className="flex w-5 justify-center">
        <Proofing live />
      </span>
      <span key={label} className="text-shimmer motion-safe:animate-fade">
        {label}
      </span>
    </div>
  );
}

/**
 * Searches in a row read as one trace, where the first began: side by side
 * within a step, one after another across steps. Words or thoughts between
 * them start a new one.
 */
function tracesOf(parts: ChatMessage["parts"]): Map<number, SearchPart[][]> {
  const traces = new Map<number, SearchPart[][]>();
  let trace: SearchPart[][] | undefined;
  let stepped = false;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part.type === "tool-search") {
      if (!trace) {
        trace = [[part]];
        traces.set(index, trace);
      } else if (stepped) trace.push([part]);
      else trace[trace.length - 1].push(part);
      stepped = false;
    } else if (part.type === "step-start") stepped = true;
    else if (shows(part)) trace = undefined;
  }
  return traces;
}

function shows(part: ChatMessage["parts"][number]): boolean {
  return (
    (part.type === "text" || part.type === "reasoning") && !!part.text.trim()
  );
}

/**
 * What the model is doing while nothing arrives, if nothing does: before the
 * first part, between steps, or once every search in a row is through.
 */
function pending(message: ChatMessage): string | undefined {
  if (message.role !== "assistant") return undefined;
  let searched = false;
  let found = false;
  for (let index = message.parts.length - 1; index >= 0; index--) {
    const part = message.parts[index];
    if (part.type === "tool-search") {
      if (part.state === "output-available" && part.output.status === "done") {
        found ||= part.output.sources.length > 0;
      } else if (part.state !== "output-error") return undefined;
      searched = true;
    } else if (part.type === "text" || part.type === "reasoning") {
      if (searched) {
        if (shows(part)) break;
        continue;
      }
      const quiet =
        part.type === "text" ? part.text.length === 0 : part.state === "done";
      return quiet ? "Thinking" : undefined;
    }
  }
  return found ? "Reading sources" : "Thinking";
}
