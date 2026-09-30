import { redirect } from "next/navigation";
import { ChatScreen } from "@/components/chat/chat-screen";
import { getViewer } from "@/lib/viewer";

export default async function NewChatPage() {
  if (!(await getViewer())) redirect("/login");
  return <ChatScreen id={crypto.randomUUID()} />;
}
