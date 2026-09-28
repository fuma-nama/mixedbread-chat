"use client";

import { MessageSquareIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { searchChats } from "@/app/(chat)/actions";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { type ChatSummary, useChats } from "./chats-provider";

/** Searches chat titles and messages; opens with ⌘K. */
export function SearchChats() {
  const { chats } = useChats();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatSummary[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    let stale = false;
    const timeout = setTimeout(() => {
      void searchChats(query).then((chats) => {
        if (!stale) setResults(chats);
      });
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <>
      <SidebarMenuButton onClick={() => setOpen(true)}>
        <SearchIcon />
        <span>Search chats</span>
      </SidebarMenuButton>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Search your chats by title or message"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search chats"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            {(query.trim() ? results : chats.slice(0, 8)).map((chat) => (
              <CommandItem
                key={chat.id}
                value={chat.id}
                onSelect={() => {
                  setOpen(false);
                  router.push(`/c/${chat.id}`);
                }}
              >
                <MessageSquareIcon />
                <span className="truncate">{chat.title}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
