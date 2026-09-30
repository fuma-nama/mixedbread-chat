import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatScreen } from "@/components/chat/chat-screen";
import { withNext } from "@/lib/safe-next";
import { getViewer, readChat } from "@/lib/viewer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const chat = await readChat((await params).id);
  if (!chat) return { title: "Chat not available" };
  // Shared chats are for the people given the link, not for search engines.
  return { title: chat.title, robots: { index: false } };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chat = await readChat(id);
  if (!chat) {
    // Signed out, it may be their own private chat.
    if (!(await getViewer())) redirect(withNext("/login", `/c/${id}`));
    notFound();
  }
  return <ChatScreen id={id} chat={chat} />;
}
