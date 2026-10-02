"use client";

import { cn } from "cn";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import {
  memo,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { IconSwap } from "@/components/ui/icon-swap";
import { useWindowEvent } from "@/hooks/use-window-event";
import type { SearchScope } from "@/lib/sources";
import { ModelPicker } from "./model-picker";
import { useSearchScope } from "./picks";
import { ReasoningPicker } from "./reasoning-picker";
import { SourcesPicker } from "./sources-picker";

const placeholders: Record<SearchScope, string> = {
  web: "Ask anything",
  docs: "Ask about your stores",
  both: "Ask your stores or the web",
  none: "Ask anything",
};

/** The server's limit for one message. */
const MAX_LENGTH = 20_000;
const WARN_LENGTH = 18_000;

export interface ComposerHandle {
  focus: () => void;
  /** Puts text back ahead of any typed since. */
  restore: (text: string) => void;
  element: () => HTMLElement | null;
}

/** On touch, focus opens the keyboard and Enter makes a new line. */
function coarse() {
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Memoized: its props hold still while an answer streams. */
export const Composer = memo(function Composer({
  ref,
  busy,
  onSubmit,
  onStop,
  fresh,
}: {
  ref?: React.Ref<ComposerHandle>;
  /** An answer runs; a message sent meanwhile goes to it. */
  busy: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
  fresh: boolean;
}) {
  const scope = useSearchScope();
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const reason = online ? undefined : "You’re offline";
  const tooLong = text.length > MAX_LENGTH;
  const ready = text.trim() !== "" && !tooLong && !reason;
  const stop = busy && !ready;

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
      restore: (value) => {
        setText((text) => (text ? `${value}\n\n${text}` : value));
        textareaRef.current?.focus();
      },
      element: () => formRef.current,
    }),
    [],
  );

  useWindowEvent("keydown", (event) => {
    const loose =
      document.activeElement === document.body &&
      !document.querySelector("[role=dialog]");
    const here = loose || event.target === textareaRef.current;
    if (event.key === "Escape" && busy && here) {
      onStop();
      return;
    }
    const typed =
      loose &&
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey;
    if (typed) textareaRef.current?.focus();
  });

  function submit() {
    if (!ready) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see onMouseDown
    <form
      ref={formRef}
      data-disabled={Boolean(reason)}
      data-glow={fresh || ready}
      className="relative flex w-full flex-col rounded-[22px] bg-card shadow-composer ring-1 ring-soft transition-[box-shadow,opacity] duration-200 ease-smooth focus-within:ring-foreground/15 data-[disabled=true]:opacity-60 data-[glow=true]:focus-within:shadow-[var(--elevation-composer),0_0_0_4px_oklch(from_var(--crust)_l_c_h/0.08)] data-[glow=true]:focus-within:ring-crust/40"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      // The whole card is the text field: a press on its padding focuses it.
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          target === event.currentTarget ||
          target.dataset.slot === "composer-bar"
        ) {
          event.preventDefault();
          textareaRef.current?.focus();
        }
      }}
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        ref={(textarea) => {
          textareaRef.current = textarea;
          if (textarea && !coarse()) textarea.focus();
        }}
        value={text}
        disabled={Boolean(reason)}
        placeholder={
          reason ?? (fresh ? placeholders[scope] : "Ask a follow-up")
        }
        rows={1}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            !coarse()
          ) {
            event.preventDefault();
            submit();
          }
        }}
        className="field-sizing-content max-h-[min(40vh,22rem)] min-h-[3.25rem] w-full resize-none scrollbar-thin bg-transparent px-4.5 pt-4 pb-1 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed md:text-[15px]"
      />
      <div
        data-slot="composer-bar"
        className="flex cursor-text items-center gap-0.5 px-2.5 pb-2.5 whitespace-nowrap"
      >
        <SourcesPicker />
        <ModelPicker />
        <ReasoningPicker />
        <div className="ml-auto flex shrink-0 items-center gap-3 pl-1.5">
          {text.length > WARN_LENGTH && (
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums motion-safe:animate-fade",
                tooLong ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          )}
          <button
            type={stop ? "button" : "submit"}
            aria-label={stop ? "Stop" : "Send"}
            disabled={!stop && !ready}
            onClick={
              stop
                ? () => {
                    onStop();
                    textareaRef.current?.focus();
                  }
                : undefined
            }
            data-state={stop ? "busy" : ready ? "ready" : "idle"}
            className="group/send relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised outline-offset-2 outline-ring transition-[background-color,color,scale,box-shadow] duration-200 ease-spring focus-visible:outline-2 active:scale-90 disabled:cursor-default data-[state=idle]:bg-soft data-[state=idle]:text-muted-foreground data-[state=idle]:shadow-none motion-reduce:transition-none"
          >
            <span
              aria-hidden="true"
              className="absolute -inset-[3px] rounded-full border-[1.5px] border-transparent border-t-crust opacity-0 transition-opacity duration-300 group-data-[state=busy]/send:opacity-100 group-data-[state=busy]/send:motion-safe:animate-spin"
            />
            <IconSwap
              swapped={stop}
              from={<ArrowUpIcon className="size-4" strokeWidth={2.25} />}
              to={<SquareIcon className="size-3 fill-current" />}
            />
          </button>
        </div>
      </div>
    </form>
  );
});

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
