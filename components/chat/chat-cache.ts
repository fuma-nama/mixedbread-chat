"use client";

import { createStore } from "@/hooks/use-store";
import type { ChatMessage } from "@/lib/search-tool";
import type { ChatData } from "@/lib/viewer";

export type TreeMessage = ChatMessage & { parentId: string | null };

export type CachedChat = Omit<ChatData, "messages"> & {
  messages: TreeMessage[];
};

/** The new chat, until its first message gives it a page. */
export const draft = createStore("");

/** Where SWR keeps a chat, as the server has it or as this tab last left it. */
export const chatKey = (id: string) => `/api/chats/${id}`;

/** `null` when the chat can't be read. */
export async function fetchChat(key: string): Promise<CachedChat | null> {
  const response = await fetch(key).catch(() => undefined);
  return response?.ok ? response.json() : null;
}

/** Opens `/` or `/c/[id]` in place: the chat screen follows the URL. */
export function navigate(href: string) {
  if (href === "/") draft.set(crypto.randomUUID());
  window.history.pushState(null, "", href);
}

/** A link's `onNavigate` that opens `href` in place. */
export function openLink(event: { preventDefault: () => void }, href: string) {
  event.preventDefault();
  navigate(href);
}
