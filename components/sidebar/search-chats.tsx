"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { MessageSquareIcon, SearchIcon, SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { createContext, use, useRef, useState } from "react";
import useSWR from "swr";
import { searchChats } from "@/app/(chat)/actions";
import { navigate, openLink } from "@/components/chat/chat-cache";
import { backdropClassName } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useWindowEvent } from "@/hooks/use-window-event";
import { useChatList } from "./chats-provider";

const SearchContext = createContext<(open: boolean) => void>(() => {});

/** Opens the ⌘K palette. */
export function useOpenSearch() {
  const setOpen = use(SearchContext);
  return () => setOpen(true);
}

/**
 * The ⌘K palette, which searches chat titles and messages, and ⌘⇧O for a new
 * chat. Mounted once for the app, since the sidebar renders twice.
 */
export function SearchChats({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useWindowEvent("keydown", (event) => {
    if (!event.metaKey && !event.ctrlKey) return;
    if (event.key === "k") {
      event.preventDefault();
      setOpen(!open);
    } else if (event.key.toLowerCase() === "o" && event.shiftKey) {
      event.preventDefault();
      navigate("/");
    }
  });

  return (
    <SearchContext value={setOpen}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className={backdropClassName} />
          {/* Drops in from the top third; on a short screen its list scrolls. */}
          <Dialog.Popup className="fixed top-[min(18vh,10rem)] left-1/2 z-50 flex max-h-[calc(100dvh-min(18vh,10rem)-1.5rem)] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-float transition-[opacity,scale,translate] duration-200 ease-smooth outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:-translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none">
            <Dialog.Title className="sr-only">Search chats</Dialog.Title>
            <Dialog.Description className="sr-only">
              Find a chat by its title or anything said in it.
            </Dialog.Description>
            <Palette onGo={() => setOpen(false)} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </SearchContext>
  );
}

const item =
  "flex h-10 cursor-default items-center gap-3 rounded-lg px-2.5 text-[14px] text-foreground/85 outline-none select-none data-highlighted:bg-soft data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

/** The palette's contents, fresh each time it opens. */
function Palette({ onGo }: { onGo: () => void }) {
  const chats = useChatList();
  const [query, setQuery] = useState("");
  // What is searched: the query once typing pauses.
  const [searched, setSearched] = useState("");
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Kept while the next query runs, so the list does not flicker empty.
  const { data: found, isLoading } = useSWR(
    searched ? (["search", searched] as const) : null,
    ([, text]) => searchChats(text),
    { keepPreviousData: true },
  );
  const trimmed = query.trim();
  const searching = trimmed !== "" && (trimmed !== searched || isLoading);
  const shown = trimmed ? (found ?? []) : chats.slice(0, 8);

  return (
    <Autocomplete.Root
      open
      inline
      autoHighlight="always"
      keepHighlight
      value={query}
      onValueChange={(value) => {
        setQuery(value);
        clearTimeout(pause.current);
        pause.current = setTimeout(() => setSearched(value.trim()), 180);
      }}
    >
      <div className="flex h-13 shrink-0 items-center gap-3 border-b border-soft px-4">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <Autocomplete.Input
          placeholder="Search chats"
          className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/75"
        />
        {searching && <Spinner className="text-muted-foreground" />}
      </div>
      {/* Grows and shrinks with the results, which set its height. */}
      <div
        tabIndex={-1}
        className="h-[calc(var(--content-height)+0.75rem)] max-h-[22rem] min-h-0 scroll-fade-y scroll-py-2 scrollbar-thin overflow-y-auto overscroll-contain p-1.5 transition-[height] duration-200 ease-smooth outline-none [--scroll-fade-size:1.5rem] motion-reduce:transition-none"
      >
        <div ref={trackHeight}>
          <Autocomplete.Status className="text-center text-[13.5px] text-muted-foreground not-empty:py-10">
            {trimmed &&
              !searching &&
              shown.length === 0 &&
              `No chats mention “${trimmed}”.`}
          </Autocomplete.Status>
          <Autocomplete.List className="outline-none">
            {!trimmed && (
              <Autocomplete.Item
                value="new"
                render={
                  <Link
                    href="/"
                    prefetch={false}
                    onNavigate={(event) => openLink(event, "/")}
                  />
                }
                onClick={onGo}
                className={item}
              >
                <SquarePenIcon />
                New chat
              </Autocomplete.Item>
            )}
            {shown.length > 0 && (
              <Autocomplete.Group>
                {!trimmed && (
                  <Autocomplete.GroupLabel className="px-2.5 pt-2 pb-1.5 text-xs text-muted-foreground">
                    Recent
                  </Autocomplete.GroupLabel>
                )}
                {shown.map((chat) => (
                  <Autocomplete.Item
                    key={chat.id}
                    value={chat.id}
                    render={
                      <Link
                        href={`/c/${chat.id}`}
                        prefetch={false}
                        onNavigate={(event) => openLink(event, `/c/${chat.id}`)}
                      />
                    }
                    onClick={onGo}
                    className={item}
                  >
                    <MessageSquareIcon />
                    <span className="truncate">{chat.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground/80 tabular-nums">
                      {ago(chat.updatedAt)}
                    </span>
                  </Autocomplete.Item>
                ))}
              </Autocomplete.Group>
            )}
          </Autocomplete.List>
        </div>
      </div>
    </Autocomplete.Root>
  );
}

/** Mirrors the content's height onto its scroller, which transitions to it. */
function trackHeight(content: HTMLDivElement) {
  const observer = new ResizeObserver(() => {
    content.parentElement?.style.setProperty(
      "--content-height",
      `${content.offsetHeight}px`,
    );
  });
  observer.observe(content);
  return () => observer.disconnect();
}

/** Short relative time: 5m, 3h, 2d, then the date. */
function ago(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / 60 / 24)}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
