import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Chat } from "@/components/chat/chat";
import { getChat, getMessages } from "@/lib/db/queries";
import { withNext } from "@/lib/safe-next";
import { getViewer } from "@/lib/viewer";
import { selectedModel, selectedReasoning } from "../../model";

/** The chat, when the reader may see it: they own it, or it is shared. */
const readableChat = cache(async (id: string) => {
  const [chat, viewer] = await Promise.all([getChat(id), getViewer()]);
  const owner = chat?.userId === viewer?.user.id;
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
  const [readable, messages, model, reasoning] = await Promise.all([
    readableChat(id),
    getMessages(id),
    selectedModel(),
    selectedReasoning(),
  ]);
  if (!readable) {
    // Signed out, it may be their own private chat.
    if (!(await getViewer())) redirect(withNext("/login", `/c/${id}`));
    notFound();
  }
  const { chat, owner } = readable;

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={messages}
      initialLeafId={chat.leafId}
      initialModel={model}
      initialReasoning={reasoning}
      initialTitle={chat.title}
      visibility={chat.visibility}
      readonly={!owner}
    />
  );
}
