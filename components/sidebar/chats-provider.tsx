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
  /** Signed in anonymously: chats live in this browser only. */
  guest: boolean;
  /** Replaces the list with the saved one. */
  refresh: () => void;
  /** Shows a change right away: `null` removes the chat, and a new id lists it first. */
  update: (id: string, change: Partial<ChatSummary> | null) => void;
}

const ChatsContext = createContext<Chats | null>(null);

/**
 * The sidebar's chat list, shared with the open chat. A `router.refresh()`
 * would remount a new chat whose URL was just rewritten to `/c/[id]`, so
 * changes land here instead.
 */
export function ChatsProvider({
  initialChats,
  guest,
  children,
}: {
  initialChats: ChatSummary[];
  guest: boolean;
  children: React.ReactNode;
}) {
  const [chats] = useState(() => createChats(initialChats, guest));
  return <ChatsContext value={chats}>{children}</ChatsContext>;
}

function createChats(initial: ChatSummary[], guest: boolean): Chats {
  const list = createStore(initial);
  return {
    list,
    guest,
    refresh: () => void listChats().then(list.set),
    update(id, change) {
      const chats = list.get();
      if (!change) {
        list.set(chats.filter((chat) => chat.id !== id));
        return;
      }
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
