"use client";

import { cn } from "cn";
import { PencilIcon, RefreshCwIcon } from "lucide-react";
import { memo, useRef, useState } from "react";
import { Proofing } from "@/components/brand/bakery";
import { type Citations, copyTextOf, textOf } from "@/lib/messages";
import type { ChatMessage } from "@/lib/search-tool";
import { CitationHighlight } from "./citation";
import { LazyMarkdown } from "./lazy-markdown";
import { Action, CopyAction, Versions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { Reasoning } from "./reasoning";
import { Search, type SearchPart } from "./search";
import { Sources } from "./sources";

/** Sent just now it rises in; brought back by a version switch it fades in. */
export type Appear = "rise" | "fade" | undefined;

/** Memoized: its props stay the same while another message streams. */
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
  live: boolean;
  stopped: boolean;
  /** Its place among its edits or retries, oldest first, and how many there are. */
  version: number;
  versions: number;
  /** Its actions show without hovering, as the latest answer's do. Touch screens show them all. */
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
  const switcher = onSwitch && versions > 1 && (
    <Versions
      version={version}
      versions={versions}
      onSwitch={(step) => onSwitch(message.id, step)}
    />
  );

  return (
    <CitationHighlight>
      <div
        ref={ref}
        data-role={message.role}
        data-message-id={message.id}
        aria-busy={live || undefined}
        className={cn(
          "group/message flex w-full flex-col gap-3 first:mt-0",
          // An answer sits close to its question; a new question starts a new turn.
          user ? "relative mt-10 items-end" : "mt-8",
          appear === "rise" && !editing && "motion-safe:animate-rise",
        )}
      >
        {editing ? (
          <MessageEditor
            defaultValue={textOf(message)}
            onCancel={() => {
              setEditing(false);
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
        ) : (
          <>
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
                        <Search
                          key={part.toolCallId}
                          steps={steps}
                          live={live}
                        />
                      )
                    );
                  }
                  default:
                    return null;
                }
              })}
            </div>
            {/* Shown a beat late, so quick answers never flash it. */}
            {waiting && (
              <div className="-ml-1 flex items-center gap-2 py-0.5 pl-1 text-[13.5px] motion-safe:animate-[fade_240ms_150ms_both] [[data-slot=parts]:has(>[data-slot=activity]:last-child)+&]:-mt-2">
                <span className="flex w-5 justify-center">
                  <Proofing live />
                </span>
                <span
                  key={waiting}
                  className="text-shimmer motion-safe:animate-fade"
                >
                  {waiting}
                </span>
              </div>
            )}
            {stopped && (
              <p className="text-[12.5px] text-muted-foreground">Stopped</p>
            )}
            {!live && (
              <>
                <Sources citations={citations} animate={appear === "rise"} />
                <div
                  className={cn(
                    "flex items-center gap-1 text-muted-foreground",
                    // A question's actions float in the gap below it instead of widening it.
                    user
                      ? "absolute top-full right-0 -mr-1.5 pt-0.5"
                      : "-my-1 -ml-1.5",
                    // Once an answer lands, its actions follow the sources in.
                    appear === "rise" &&
                      "motion-safe:animate-[fade_320ms_var(--ease-smooth)_140ms_backwards]",
                  )}
                >
                  {/* The switcher stays put at the message's edge; actions come and go beside it. */}
                  {!user && switcher}
                  <div
                    className={cn(
                      "flex items-center transition-opacity duration-200",
                      // Hidden actions stay out of the way of clicks until the message is hovered.
                      !pinned &&
                        "pointer-events-none opacity-0 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
                    )}
                  >
                    {!!textOf(message).trim() && (
                      <CopyAction
                        label="Copy"
                        copy={() =>
                          navigator.clipboard.writeText(
                            copyTextOf(message, citations),
                          )
                        }
                      />
                    )}
                    {user && onEdit && (
                      <Action
                        label="Edit"
                        data-action="edit"
                        onClick={() => setEditing(true)}
                      >
                        <PencilIcon />
                      </Action>
                    )}
                    {!user && onRetry && (
                      <Action
                        label={retryLabel ?? "Try again"}
                        onClick={() => onRetry(message.id)}
                      >
                        <RefreshCwIcon />
                      </Action>
                    )}
                  </div>
                  {user && switcher}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </CitationHighlight>
  );
});

/** Searches in a row form one trace, where the first began; words or thoughts start a new one. */
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

/** What the model is doing while nothing arrives: before the first part, between steps, or after searching. */
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
