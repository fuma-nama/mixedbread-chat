"use client";

import { MessageSquareIcon, SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { createContext, use, useEffect, useState } from "react";
import { searchChats } from "@/app/(chat)/actions";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { useWindowEvent } from "@/hooks/use-window-event";
import { type ChatSummary, useChatList } from "./chats-provider";

const SearchContext = createContext<(open: boolean) => void>(() => {});

/** Opens the ⌘K palette. */
export function useOpenSearch() {
  const setOpen = use(SearchContext);
  return () => setOpen(true);
}

/**
 * Searches chat titles and messages. Mounted once for the app, since the
 * sidebar renders twice (beside the panel, and in the phone drawer).
 */
export function SearchChats({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useWindowEvent("keydown", (event) => {
    if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setOpen(!open);
    }
  });

  return (
    <SearchContext value={setOpen}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Find a chat by its title or anything said in it."
      >
        <Palette onGo={() => setOpen(false)} />
      </CommandDialog>
    </SearchContext>
  );
}

/** The palette's contents, fresh each time it opens. */
function Palette({ onGo }: { onGo: () => void }) {
  const chats = useChatList();
  const [query, setQuery] = useState("");
  // Kept while the next query runs, so the list does not flicker empty.
  const [results, setResults] = useState<{
    query: string;
    chats: ChatSummary[];
  }>();
  const trimmed = query.trim();
  const searching = trimmed !== "" && results?.query !== trimmed;

  useEffect(() => {
    if (!trimmed) return;
    let stale = false;
    const timeout = setTimeout(() => {
      void searchChats(trimmed).then((chats) => {
        if (!stale) setResults({ query: trimmed, chats });
      });
    }, 180);
    return () => {
      stale = true;
      clearTimeout(timeout);
    };
  }, [trimmed]);

  const shown = trimmed ? (results?.chats ?? []) : chats.slice(0, 8);

  return (
    <Command value={query} onValueChange={setQuery}>
      <CommandInput placeholder="Search chats">
        {searching && <Spinner className="text-muted-foreground" />}
      </CommandInput>
      <CommandList
        empty={
          trimmed &&
          !searching &&
          shown.length === 0 &&
          `No chats mention “${trimmed}”.`
        }
      >
        {!trimmed && (
          <CommandItem
            value="new"
            render={<Link href="/" prefetch={false} />}
            onClick={onGo}
          >
            <SquarePenIcon />
            New chat
          </CommandItem>
        )}
        {shown.length > 0 && (
          <CommandGroup heading={trimmed ? "Chats" : "Recent"}>
            {shown.map((chat) => (
              <CommandItem
                key={chat.id}
                value={chat.id}
                render={<Link href={`/c/${chat.id}`} prefetch={false} />}
                onClick={onGo}
              >
                <MessageSquareIcon />
                <span className="truncate">{chat.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground/80 tabular-nums">
                  {ago(chat.updatedAt)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
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
