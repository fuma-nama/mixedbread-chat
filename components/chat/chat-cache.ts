"use client";

import { atom, getDefaultStore, useAtomValue } from "jotai";
import { listChats } from "@/app/(chat)/actions";
import type { ChatMessage } from "@/lib/search-tool";
import type { ChatData } from "@/lib/viewer";

export type CachedChat = Omit<ChatData, "messages"> & {
  messages: (ChatMessage & { parentId: string | null })[];
};

export type ChatSummary = Awaited<ReturnType<typeof listChats>>[number];

/** The new chat, until its first message gives it a page. */
export const draftAtom = atom("");

/** The user's chats, newest first. */
export const chatsAtom = atom<ChatSummary[]>([]);

export const chatKey = (id: string) => `/api/chats/${id}`;

// Each chat's last copy, whose unchanged messages a new copy reuses so they don't render again.
const fetched = new Map<string, CachedChat>();

export async function fetchChat(key: string): Promise<CachedChat | null> {
  const response = await fetch(key);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Couldn't load ${key} (${response.status}).`);
  const chat: CachedChat = await response.json();
  // A saved message changes once, as its answer ends, so equal part counts mean it's unchanged.
  const known = new Map<string, CachedChat["messages"][number]>();
  for (const message of fetched.get(key)?.messages ?? []) {
    known.set(message.id, message);
  }
  for (let i = 0; i < chat.messages.length; i++) {
    const kept = known.get(chat.messages[i].id);
    if (kept?.parts.length === chat.messages[i].parts.length) {
      chat.messages[i] = kept;
    }
  }
  fetched.set(key, chat);
  return chat;
}

export function useChatList(): ChatSummary[] {
  return useAtomValue(chatsAtom);
}

export function changeChats(change: (chats: ChatSummary[]) => ChatSummary[]) {
  const store = getDefaultStore();
  store.set(chatsAtom, change(store.get(chatsAtom)));
}

export function refreshChats() {
  listChats().then(
    (chats) => getDefaultStore().set(chatsAtom, chats),
    () => {},
  );
}

/** Opens `/` or `/c/[id]` in place: the chat screen follows the URL. */
export function navigate(href: string) {
  if (href === "/") getDefaultStore().set(draftAtom, crypto.randomUUID());
  window.history.pushState(null, "", href);
}

export function openLink(event: { preventDefault: () => void }, href: string) {
  event.preventDefault();
  navigate(href);
}
