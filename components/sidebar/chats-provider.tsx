"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useMemo } from "react";
import { listChats } from "@/app/(chat)/actions";

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

// Shared with the open chat. A `router.refresh()` would remount a new chat
// whose URL was just rewritten to `/c/[id]`, so changes land here instead.
const chatsAtom = atom<ChatSummary[]>([]);

export function ChatsProvider({
  initialChats,
  children,
}: {
  initialChats: ChatSummary[];
  children: React.ReactNode;
}) {
  useHydrateAtoms([[chatsAtom, initialChats]]);
  return children;
}

const refreshAtom = atom(null, async (_get, set) =>
  set(chatsAtom, await listChats()),
);

/** Shows a change right away; a new id lists it first. */
const updateAtom = atom(
  null,
  (get, set, id: string, change: Partial<ChatSummary>) => {
    const chats = get(chatsAtom);
    const index = chats.findIndex((chat) => chat.id === id);
    set(
      chatsAtom,
      index === -1
        ? [
            { id, title: "New chat", updatedAt: new Date(), ...change },
            ...chats,
          ]
        : chats.with(index, { ...chats[index], ...change }),
    );
  },
);

/** Takes chats off the list at once, returning what puts the list back. */
const removeAtom = atom(null, (get, set, ids: ReadonlySet<string>) => {
  const before = get(chatsAtom);
  set(
    chatsAtom,
    before.filter((chat) => !ids.has(chat.id)),
  );
  return () => set(chatsAtom, before);
});

/** The list's actions; using them never re-renders. */
export function useChats() {
  return {
    refresh: useSetAtom(refreshAtom),
    update: useSetAtom(updateAtom),
    remove: useSetAtom(removeAtom),
  };
}

export function useChatList(): ChatSummary[] {
  return useAtomValue(chatsAtom);
}

export function useChatTitle(id: string): string | undefined {
  return useAtomValue(
    useMemo(
      () => atom((get) => get(chatsAtom).find((chat) => chat.id === id)?.title),
      [id],
    ),
  );
}
