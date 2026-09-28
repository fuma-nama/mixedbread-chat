import { notFound } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { getSession } from "@/lib/auth";
import { getChat, getMessages } from "@/lib/db/queries";
import { selectedModel } from "../../model";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [chat, session] = await Promise.all([getChat(id), getSession()]);
  const owner = chat?.userId === session?.user.id;
  if (!chat || (!owner && chat.visibility !== "public")) notFound();

  const messages = await getMessages(id);

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={messages.map(({ id, parentId, role, parts }) => ({
        id,
        parentId,
        role,
        parts,
      }))}
      initialLeafId={chat.leafId}
      initialModel={await selectedModel()}
      visibility={chat.visibility}
      readonly={!owner}
    />
  );
}
