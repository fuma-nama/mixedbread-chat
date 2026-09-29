"use client";

import { createContext, use, useState } from "react";
import { listChats } from "@/app/(chat)/actions";
import { createStore, type Store, useStore } from "@/hooks/use-store";

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

interface Chats {
  list: Store<ChatSummary[]>;
  /** Replaces the list with the saved one. */
  refresh: () => void;
  /** Shows a change right away; a new id lists it first. */
  update: (id: string, change: Partial<ChatSummary>) => void;
  /** Takes chats off the list at once, returning what puts the list back. */
  remove: (ids: ReadonlySet<string>) => () => void;
}

const ChatsContext = createContext<Chats | null>(null);

/**
 * The sidebar's chat list, shared with the open chat. A `router.refresh()`
 * would remount a new chat whose URL was just rewritten to `/c/[id]`, so
 * changes land here instead.
 */
export function ChatsProvider({
  initialChats,
  children,
}: {
  initialChats: ChatSummary[];
  children: React.ReactNode;
}) {
  const [chats] = useState(() => createChats(initialChats));
  return <ChatsContext value={chats}>{children}</ChatsContext>;
}

function createChats(initial: ChatSummary[]): Chats {
  const list = createStore(initial);
  return {
    list,
    refresh: () => void listChats().then(list.set),
    update(id, change) {
      const chats = list.get();
      const index = chats.findIndex((chat) => chat.id === id);
      list.set(
        index === -1
          ? [
              { id, title: "New chat", updatedAt: new Date(), ...change },
              ...chats,
            ]
          : chats.with(index, { ...chats[index], ...change }),
      );
    },
    remove(ids) {
      const before = list.get();
      list.set(before.filter((chat) => !ids.has(chat.id)));
      return () => list.set(before);
    },
  };
}

/** The list's actions; reading them never re-renders. */
export function useChats(): Chats {
  const chats = use(ChatsContext);
  if (!chats) throw new Error("useChats needs a <ChatsProvider>");
  return chats;
}

export function useChatList(): ChatSummary[] {
  return useStore(useChats().list, (chats) => chats);
}

export function useChatTitle(id: string): string | undefined {
  return useStore(
    useChats().list,
    (chats) => chats.find((chat) => chat.id === id)?.title,
  );
}
