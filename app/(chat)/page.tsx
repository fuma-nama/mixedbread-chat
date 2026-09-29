import { redirect } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { getViewer } from "@/lib/viewer";
import { selectedModel, selectedReasoning } from "./model";

export default async function NewChatPage() {
  const id = crypto.randomUUID();
  const [viewer, model, reasoning] = await Promise.all([
    getViewer(),
    selectedModel(),
    selectedReasoning(),
  ]);
  if (!viewer) redirect("/login");

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      initialLeafId={null}
      initialModel={model}
      initialReasoning={reasoning}
      visibility="private"
    />
  );
}
