"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWRImmutable from "swr/immutable";
import { SliceGlyph } from "@/components/brand/slice";
import { buttonVariants } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { Chat } from "./chat";
import {
  type CachedChat,
  chatKey,
  draft,
  fetchChat,
  openLink,
} from "./chat-cache";
import { ChatHeader } from "./chat-header";

const NEW_CHAT: CachedChat = {
  title: "",
  visibility: "private",
  leafId: null,
  owner: true,
  messages: [],
};

/**
 * The open chat. It follows the URL, which `navigate` changes in place, so
 * switching chats needs no server-rendered page. The page it was rendered
 * with seeds it: a chat, or with none, the id of a new one.
 */
export function ChatScreen({
  id: seedId,
  chat: seed,
}: {
  id: string;
  chat?: CachedChat;
}) {
  const draftId = useStore(draft, (id) => id) || (seed ? "" : seedId);
  const id = usePathname().match(/^\/c\/([^/]+)/)?.[1] ?? draftId;
  const fallback = id === draftId ? NEW_CHAT : id === seedId ? seed : undefined;
  return <OpenChat key={id} id={id} fallback={fallback} />;
}

function OpenChat({ id, fallback }: { id: string; fallback?: CachedChat }) {
  // A chat the page brought, or a new one, is never fetched: only kept.
  const { data = fallback } = useSWRImmutable(
    chatKey(id),
    fallback ? null : fetchChat,
  );

  if (data === undefined) return <ChatSkeleton />;
  if (data === null) return <ChatMissing />;
  return <Chat id={id} saved={data} />;
}

export function ChatSkeleton() {
  return (
    <>
      <ChatHeader />
      <div
        role="status"
        aria-label="Loading chat"
        className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col gap-3 px-4 pt-6 sm:px-6"
      >
        <div className="h-10 w-2/5 self-end rounded-[20px] bg-soft motion-safe:animate-pulse" />
        <div className="mt-8 h-3.5 w-11/12 rounded-full bg-soft motion-safe:animate-pulse motion-safe:[animation-delay:150ms]" />
        <div className="h-3.5 w-4/5 rounded-full bg-soft motion-safe:animate-pulse motion-safe:[animation-delay:300ms]" />
        <div className="h-3.5 w-3/5 rounded-full bg-soft motion-safe:animate-pulse motion-safe:[animation-delay:450ms]" />
      </div>
      <div className="mx-auto w-full max-w-[44rem] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 md:pb-5">
        <div className="h-[5.875rem] rounded-[22px] bg-card shadow-composer ring-1 ring-soft" />
      </div>
    </>
  );
}

export function ChatMissing() {
  return (
    <>
      <ChatHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-16 text-center">
        <SliceGlyph className="size-9 text-muted-foreground/35 motion-safe:animate-settle" />
        <h1 className="text-[1.375rem] leading-tight font-normal tracking-[-0.02em] motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
          This chat isn’t available
        </h1>
        <Link
          href="/"
          onNavigate={(event) => openLink(event, "/")}
          className={buttonVariants({
            className:
              "motion-safe:animate-rise motion-safe:[animation-delay:140ms]",
          })}
        >
          Start a chat
        </Link>
      </div>
    </>
  );
}
