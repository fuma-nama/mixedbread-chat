"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatItem } from "./chat-item";
import type { ChatSummary } from "./chats-provider";
import { HoverArea } from "./hover-area";

/** Chats by day. */
export function ChatList({
  chats,
  now,
  timeZone,
  activeId,
  selection,
  onOpen,
  onDelete,
}: {
  chats: ChatSummary[];
  now: number;
  timeZone: string;
  activeId?: string;
  /** The selected chats, while some are. */
  selection?: ReadonlySet<string>;
  onOpen: (event: { preventDefault: () => void }, href: string) => void;
  onDelete: (chat: ChatSummary) => void;
}) {
  const groups = useMemo(
    () => groupByDay(chats, now, timeZone),
    [chats, now, timeZone],
  );
  // Chats listed later than this slide in; the ones a page loads with do not.
  const [listed] = useState(() => new Set(chats.map((chat) => chat.id)));

  // Lets the server group chats by the reader's own days on the next load.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone !== timeZone) {
      void cookieStore.set({
        name: "tz",
        value: zone,
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
    }
  }, [timeZone]);

  return (
    <HoverArea>
      {groups.map((group) => (
        <section key={group.label} className="pt-4 first:pt-2">
          <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground/80">
            {group.label}
          </h3>
          <ul className="flex flex-col gap-px">
            {group.chats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeId}
                fresh={!listed.has(chat.id)}
                selected={selection?.has(chat.id)}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </HoverArea>
  );
}

const DAY = 24 * 60 * 60 * 1000;

function groupByDay(chats: ChatSummary[], now: number, timeZone: string) {
  // Midnight of each day on the reader's calendar, as a UTC timestamp.
  const format = new Intl.DateTimeFormat("en-CA", { timeZone });
  const dayOf = (time: number) => Date.parse(format.format(time));
  const today = dayOf(now);

  const groups: { label: string; chats: ChatSummary[] }[] = [];
  for (const chat of chats) {
    const days = Math.round((today - dayOf(chat.updatedAt.getTime())) / DAY);
    const label =
      days <= 0
        ? "Today"
        : days === 1
          ? "Yesterday"
          : days < 7
            ? "Previous 7 days"
            : days < 30
              ? "Previous 30 days"
              : "Older";
    const last = groups.at(-1);
    if (last?.label === label) last.chats.push(chat);
    else groups.push({ label, chats: [chat] });
  }
  return groups;
}
