"use client";

import { cn } from "cn";
import { ArrowDownIcon } from "lucide-react";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-media";
import { SourceCards } from "./citation";

/** Where an asked question comes to rest: just clear of the top edge's fade. */
const TOP = 32;

interface Scroll {
  /** Keeps the end in view as the list grows, until the reader scrolls up. */
  follow: boolean;
  question?: string;
  /** Where this view last scrolled itself, to tell its scrolls from the reader's. */
  set?: number;
  lastTop: number;
  frame?: number;
}

/**
 * The message list. It opens on the latest message and sticks to the end as
 * answers stream, until you scroll up; reaching the end again sticks once
 * more. A question you ask glides to the top first, with its answer filling
 * the room below it.
 */
export function Conversation({
  children,
  turn,
  streaming,
}: {
  children: React.ReactNode;
  /** The question just asked, and a key that changes with every ask. */
  turn?: { id: string; key: number };
  streaming: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [atEnd, setAtEnd] = useState(true);
  // Opened from history, the view holds on to the end while the page settles.
  const scroll = useRef<Scroll>({ follow: !turn, lastTop: 0 });
  const turnId = turn?.id;
  const turnKey = turn?.key;

  // Keep up with a stream smoothly; settle a loading page at once.
  const follow = useEffectEvent((scroller: HTMLElement) => {
    if (streaming)
      glide(scroller, scroll.current, () => endOf(scroller), reduced);
    else jump(scroller, scroll.current, endOf(scroller));
  });

  const pin = useEffectEvent((id: string) => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    const list = listRef.current;
    if (!scroller || !content || !list) return;
    const state = scroll.current;
    state.question = id;
    state.follow = true;
    makeRoom(content, list, id);
    glide(
      scroller,
      state,
      () => restingTop(list, id) ?? scroller.scrollTop,
      reduced,
    );
  });

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    const list = listRef.current;
    if (!scroller || !content || !list) return;
    const state = scroll.current;

    if (state.follow) jump(scroller, state, endOf(scroller));

    const observer = new ResizeObserver(() => {
      makeRoom(content, list, state.question);
      if (state.follow) follow(scroller);
      setAtEnd(isAtEnd(scroller));
    });
    observer.observe(list);
    observer.observe(scroller);

    const onScroll = () => {
      const top = scroller.scrollTop;
      if (state.set === undefined || Math.abs(top - state.set) > 1) {
        // The reader scrolled: up lets go of the end, down to it takes hold
        // again, and either way any glide of ours stops.
        stop(state);
        if (top < state.lastTop - 1) state.follow = false;
        else if (isAtEnd(scroller)) state.follow = true;
      }
      state.lastTop = top;
      setAtEnd(isAtEnd(scroller));
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      stop(state);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (turnKey !== undefined && turnId) pin(turnId);
  }, [turnId, turnKey]);

  return (
    <div className="relative min-h-0 flex-1 motion-safe:animate-fade motion-safe:[animation-duration:220ms]">
      <div
        ref={scrollRef}
        className="[container-type:size] relative h-full w-full scroll-fade-y scrollbar-thin scrollbar-gutter-both overflow-y-auto overscroll-contain outline-offset-2 outline-ring [--scroll-fade-size:1.75rem] focus-visible:outline-2"
      >
        <div
          ref={contentRef}
          className="mx-auto w-full max-w-[44rem] px-4 pt-8 pb-10 sm:px-6"
        >
          <div
            ref={listRef}
            role="log"
            aria-live="off"
            className="relative flex flex-col"
          >
            <SourceCards>{children}</SourceCards>
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Scroll to latest"
        tabIndex={atEnd ? -1 : 0}
        data-hidden={atEnd}
        onClick={() => {
          const scroller = scrollRef.current;
          if (!scroller) return;
          scroll.current.follow = true;
          glide(scroller, scroll.current, () => endOf(scroller), reduced);
        }}
        className="absolute bottom-3 left-1/2 flex size-8 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground shadow-float outline-offset-2 outline-ring transition-[opacity,translate,color] duration-300 ease-smooth hover:text-foreground focus-visible:outline-2 data-[hidden=true]:pointer-events-none data-[hidden=true]:translate-y-2 data-[hidden=true]:opacity-0 motion-reduce:transition-none"
      >
        <ArrowDownIcon
          className={cn("size-4", streaming && "motion-safe:animate-nudge")}
        />
      </button>
    </div>
  );
}

/** Layout offsets rather than boxes on screen, which move while the question rises in. */
function restingTop(list: HTMLElement, id?: string): number | undefined {
  const question =
    id &&
    list.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
  return question ? list.offsetTop + question.offsetTop - TOP : undefined;
}

/**
 * Makes the list at least a view taller than where the question rests, so it
 * can reach the top while its answer is short.
 */
function makeRoom(content: HTMLElement, list: HTMLElement, id?: string) {
  const top = restingTop(list, id);
  content.style.minHeight = top === undefined ? "" : `calc(${top}px + 100cqh)`;
}

function endOf(scroller: HTMLElement): number {
  return scroller.scrollHeight - scroller.clientHeight;
}

function isAtEnd(scroller: HTMLElement): boolean {
  return endOf(scroller) - scroller.scrollTop < 8;
}

function jump(scroller: HTMLElement, state: Scroll, top: number) {
  scroller.scrollTop = top;
  state.set = scroller.scrollTop;
}

function stop(state: Scroll) {
  if (state.frame !== undefined) cancelAnimationFrame(state.frame);
  state.frame = undefined;
}

/** Scrolls to `target` on the app's easing: quick to leave, slow to land. */
function glide(
  scroller: HTMLElement,
  state: Scroll,
  target: () => number,
  instant = false,
) {
  stop(state);
  const from = scroller.scrollTop;
  const distance = Math.abs(target() - from);
  if (instant || distance < 2) {
    jump(scroller, state, target());
    return;
  }
  const duration = Math.min(640, Math.max(320, distance / 2));
  // A frame's timestamp can come from before this call, which would start the
  // glide going the wrong way, so the clock starts on the first frame.
  let start: number | undefined;
  const step = (now: number) => {
    start ??= now;
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 5;
    jump(scroller, state, from + (target() - from) * eased);
    state.frame = progress < 1 ? requestAnimationFrame(step) : undefined;
  };
  state.frame = requestAnimationFrame(step);
}
