"use client";

import { cn } from "cn";
import { PencilIcon, RefreshCwIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, Suspense, useRef, useState } from "react";
import { Proofing } from "@/components/brand/bakery";
import { SliceGlyph } from "@/components/brand/slice";
import { Button } from "@/components/ui/button";
import { type Citations, copyTextOf, textOf } from "@/lib/messages";
import { originOf } from "@/lib/mixedbread/citations";
import type { ChatMessage } from "@/lib/search-tool";
import { Activity, formatSeconds, LiveLine } from "./activity";
import { SourcePreview } from "./citation";
import { Action, CopyAction, Versions } from "./message-actions";
import { useModel } from "./picks";
import { Search, type SearchPart } from "./search";

// Streamdown, its highlighter and KaTeX load with the first answer, not the page.
const Markdown = dynamic(() =>
  import("./markdown").then((mod) => mod.Markdown),
);

export function preloadMarkdown() {
  void import("./markdown");
}

/** Sent just now it rises in; brought back by a version switch it fades in. */
export type Appear = "rise" | "fade" | undefined;

/** Memoized: its props stay the same while another message streams. */
export const MessageView = memo(function MessageView({
  message,
  citations,
  appear,
  live,
  version,
  versions,
  pinned,
  onEdit,
  onRetry,
  onSwitch,
}: {
  message: ChatMessage;
  citations: Citations;
  appear: Appear;
  live: boolean;
  version: number;
  versions: number;
  /** Its actions show without hovering. */
  pinned: boolean;
  onEdit?: (messageId: string, text: string) => void;
  onRetry?: (messageId: string) => void;
  onSwitch?: (messageId: string, step: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const model = useModel().current;
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
    <div
      ref={ref}
      data-message-id={message.id}
      aria-busy={live || undefined}
      className={cn(
        "group/message flex w-full flex-col gap-3 first:mt-0",
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
          {endOf(message) === "stopped" && (
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
                  appear === "rise" &&
                    "motion-safe:animate-[fade_320ms_var(--ease-smooth)_140ms_backwards]",
                )}
              >
                {/* The switcher stays put at the message's edge; actions come and go beside it. */}
                {!user && switcher}
                <div
                  className={cn(
                    "flex items-center transition-opacity duration-200",
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
                      label={
                        model ? `Try again with ${model.name}` : "Try again"
                      }
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
  );
});

/** How an answer ended short of done. */
export function endOf(message: ChatMessage | undefined) {
  return message?.parts.findLast((part) => part.type === "data-ended")?.data;
}

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

/** What the model is doing while nothing arrives. */
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

function Sources({
  citations,
  animate,
}: {
  citations: Citations;
  animate: boolean;
}) {
  if (citations.size === 0) return null;

  return (
    <ol aria-label="Sources" className="flex flex-wrap gap-1.5">
      {Array.from(citations.values(), ({ number, source }, index) => (
        <li
          key={source.label}
          className={animate ? "motion-safe:animate-rise" : undefined}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <SourcePreview
            source={source}
            number={number}
            side="bottom"
            align="start"
            className="group/chip flex h-7 max-w-60 cursor-pointer items-center gap-1.5 rounded-lg bg-card pr-2 pl-1.5 text-[12.5px] text-foreground/75 shadow-raised ring-1 ring-soft outline-offset-1 outline-ring transition-[color,box-shadow,background-color] duration-150 hover:text-foreground hover:ring-berry/35 focus-visible:outline-2 data-lit:text-foreground data-lit:ring-berry/45 data-popup-open:ring-berry/45"
          >
            <SliceGlyph
              className={cn(
                "size-3.5 text-berry",
                animate && "motion-safe:animate-settle",
              )}
              style={{ animationDelay: `${150 + number * 60}ms` }}
            />
            <span className="truncate">{originOf(source)}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
              {number}
            </span>
          </SourcePreview>
        </li>
      ))}
    </ol>
  );
}

function MessageEditor({
  defaultValue,
  onCancel,
  onSubmit,
}: {
  defaultValue: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(defaultValue);

  function submit() {
    if (text.trim()) onSubmit(text.trim());
  }

  return (
    <div className="flex w-full max-w-[85%] flex-col gap-3 rounded-[20px] bg-card p-3 shadow-raised ring-1 ring-crust/40 motion-safe:animate-fade motion-safe:[animation-duration:150ms]">
      <textarea
        aria-label="Edit message"
        value={text}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by pressing Edit
        autoFocus
        onFocus={(event) => {
          const { length } = event.currentTarget.value;
          event.currentTarget.setSelectionRange(length, length);
        }}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
        className="field-sizing-content max-h-72 min-h-10 w-full resize-none scrollbar-thin bg-transparent px-1 text-base leading-relaxed outline-none md:text-[15px]"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button size="sm" disabled={!text.trim()} onClick={submit}>
          Send
        </Button>
      </div>
    </div>
  );
}

// Text from the start is in the first HTML; later text waits for the renderer on its own.
function LazyMarkdown({
  deferred,
  ...props
}: React.ComponentProps<typeof Markdown> & { deferred: boolean }) {
  const markdown = <Markdown {...props} />;
  return deferred ? <Suspense>{markdown}</Suspense> : markdown;
}

/** Memoized, so finished thoughts sit still while the answer streams. */
const Reasoning = memo(function Reasoning({
  text,
  live,
  deferred,
}: {
  text: string;
  live: boolean;
  deferred: boolean;
}) {
  const [span, setSpan] = useState(() =>
    live ? { start: Date.now(), end: 0 } : undefined,
  );
  // oxlint-disable-next-line react/purity -- stamped once, as `live` turns off
  if (span && !live && !span.end) setSpan({ ...span, end: Date.now() });
  if (!text && !live) return null;
  const seconds = span?.end ? (span.end - span.start) / 1000 : 0;

  return (
    <Activity
      indicator={<Proofing live={live} />}
      label={
        live ? (
          <span className="text-shimmer motion-safe:animate-shimmer">
            Thinking
          </span>
        ) : seconds >= 1 ? (
          `Thought for ${formatSeconds(seconds)}`
        ) : (
          "Thought"
        )
      }
      status={live && <LiveLine text={latestThought(text)} />}
    >
      <LazyMarkdown
        deferred={deferred}
        isAnimating={live}
        className="text-[13px]/relaxed text-muted-foreground"
      >
        {text}
      </LazyMarkdown>
    </Activity>
  );
});

function latestThought(text: string): string | undefined {
  let heading: string | undefined;
  for (const [, title] of text.matchAll(/\*\*(.+?)\*\*/g)) heading = title;
  if (heading) return heading;

  const trimmed = text.trim();
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  // The last sentence may still be arriving; show the one before it.
  return sentences.at(/[.!?]$/.test(trimmed) ? -1 : -2)?.replace(/\s+/g, " ");
}
