import { Chat } from "@/components/chat/chat";
import { searchScope } from "@/lib/search-tool";
import { selectedModel } from "./model";

export default async function NewChatPage() {
  const id = crypto.randomUUID();

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      initialLeafId={null}
      initialModel={await selectedModel()}
      visibility="private"
      scope={searchScope}
    />
  );
}
