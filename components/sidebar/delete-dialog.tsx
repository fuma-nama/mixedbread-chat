"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ChatSummary } from "./chats-provider";

/** Asks before chats are deleted for good. */
export function DeleteDialog({
  chats,
  landing,
  onCancel,
  onDelete,
}: {
  chats?: ChatSummary[];
  /** Where focus goes once they are deleted. */
  landing: React.RefObject<HTMLElement | null>;
  onCancel: () => void;
  onDelete: (chats: ChatSummary[]) => void;
}) {
  // Kept while the dialog fades out, so its words don't vanish first.
  const [shown, setShown] = useState(chats);
  if (chats && chats !== shown) setShown(chats);
  const [first] = shown ?? [];
  const count = shown?.length ?? 0;

  return (
    <AlertDialog
      open={chats !== undefined}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent finalFocus={landing}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1 ? "Delete chat?" : `Delete ${count} chats?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {count === 1
              ? `“${first.title}” will be deleted for good.`
              : "They’ll be deleted for good."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => shown && onDelete(shown)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
