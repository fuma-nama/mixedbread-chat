import { SidebarTrigger } from "@/components/ui/sidebar";
import type { ModelId } from "@/lib/models";
import { ModelPicker } from "./model-picker";
import { ShareDialog } from "./share-dialog";

export function ChatHeader({
  chatId,
  model,
  onModelChange,
  visibility,
}: {
  chatId: string;
  /** Hidden when undefined, as on someone else's shared chat. */
  model?: ModelId;
  onModelChange: (model: ModelId) => void;
  /** Hidden when undefined, as before the first message. */
  visibility?: "private" | "public";
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 px-3">
      <SidebarTrigger />
      {model && <ModelPicker value={model} onChange={onModelChange} />}
      {visibility && (
        <ShareDialog
          chatId={chatId}
          initialVisibility={visibility}
          className="ml-auto"
        />
      )}
    </header>
  );
}
