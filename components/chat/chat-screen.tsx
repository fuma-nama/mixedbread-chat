"use client";

import { useAtomValue } from "jotai";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { SliceGlyph } from "@/components/brand/slice";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Chat } from "./chat";
import {
  type CachedChat,
  chatKey,
  draftAtom,
  fetchChat,
  openLink,
} from "./chat-cache";
import { ChatHeader } from "./chat-header";
import { useOrganizations } from "./picks";

const NEW_CHAT: CachedChat = {
  title: "",
  visibility: "private",
  leafId: null,
  owner: true,
  running: false,
  messages: [],
};

/** Follows the URL, which `navigate` changes in place; without `chat`, `id` is a new chat's. */
export function ChatScreen({
  id: seedId,
  chat: seed,
}: {
  id: string;
  chat?: CachedChat | null;
}) {
  const draftId = useAtomValue(draftAtom) || (seed === undefined ? seedId : "");
  const id = usePathname().match(/^\/c\/([^/]+)/)?.[1] ?? draftId;
  const signedIn = useOrganizations().length > 0;

  // Better Auth sends the tab back with why connecting didn't finish.
  useEffect(() => {
    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    if (!error) return;
    url.searchParams.delete("error");
    window.history.replaceState(null, "", url);
    // The toaster above subscribes in its own effect, which runs after this one.
    queueMicrotask(() =>
      toast.add({
        title:
          error === "access_denied"
            ? "Connecting was cancelled."
            : "Connecting didn’t finish. Try again.",
      }),
    );
  }, []);

  // As the page of a new chat does, for someone reading a shared one.
  if (id === draftId && !signedIn) redirect("/login");
  const fallback = id === draftId ? NEW_CHAT : id === seedId ? seed : undefined;
  return <OpenChat key={id} id={id} fallback={fallback} />;
}

function OpenChat({
  id,
  fallback,
}: {
  id: string;
  fallback?: CachedChat | null;
}) {
  const { data: kept, error } = useSWR(chatKey(id), fetchChat, {
    fallbackData: fallback,
    // The page's chat is current; one kept from before may not be.
    revalidateOnMount: fallback === undefined,
    // The owner's tabs catch up as they follow the chat.
    revalidateOnFocus: fallback?.owner === false,
  });
  // A new chat has no row until its first answer starts.
  const data = kept === null && fallback === NEW_CHAT ? NEW_CHAT : kept;

  if (data === null || (data === undefined && error)) return <ChatMissing />;
  if (data === undefined) return <ChatSkeleton />;
  return <Chat id={id} saved={data} />;
}

export function ChatSkeleton() {
  return (
    <>
      <title>Bread Chat</title>
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

function ChatMissing() {
  return (
    <>
      <title>Chat not available · Bread Chat</title>
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
