import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Chat } from "@/components/chat/chat";
import { getSession } from "@/lib/auth";
import { getChat, getMessages } from "@/lib/db/queries";
import { searchScope } from "@/lib/search-tool";
import { selectedModel } from "../../model";

/** The chat, when the reader may see it: they own it, or it is shared. */
const readableChat = cache(async (id: string) => {
  const [chat, session] = await Promise.all([getChat(id), getSession()]);
  const owner = chat?.userId === session?.user.id;
  if (!chat || (!owner && chat.visibility !== "public")) return undefined;
  return { chat, owner };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const readable = await readableChat((await params).id);
  if (!readable) return { title: "Chat not available" };
  // Shared chats are for the people given the link, not for search engines.
  return {
    title: readable.chat.title,
    robots: { index: false },
  };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [readable, messages, model] = await Promise.all([
    readableChat(id),
    getMessages(id),
    selectedModel(),
  ]);
  if (!readable) notFound();
  const { chat, owner } = readable;

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={messages}
      initialLeafId={chat.leafId}
      initialModel={model}
      initialTitle={chat.title}
      visibility={chat.visibility}
      scope={searchScope}
      readonly={!owner}
    />
  );
}
