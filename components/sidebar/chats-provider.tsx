"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { listChats } from "@/app/(chat)/actions";

export interface ChatSummary {
  id: string;
  title: string;
}

const ChatsContext = createContext<{
  chats: ChatSummary[];
  refresh: () => void;
} | null>(null);

/**
 * The sidebar's chat list, refreshed on demand. A `router.refresh()` would
 * remount a new chat whose URL was just rewritten to `/c/[id]`.
 */
export function ChatsProvider({
  initialChats,
  children,
}: {
  initialChats: ChatSummary[];
  children: React.ReactNode;
}) {
  const [chats, setChats] = useState(initialChats);
  const refresh = useCallback(() => {
    void listChats().then(setChats);
  }, []);

  return <ChatsContext value={{ chats, refresh }}>{children}</ChatsContext>;
}

export function useChats() {
  const context = useContext(ChatsContext);
  if (!context) throw new Error("useChats needs a <ChatsProvider>");
  return context;
}
