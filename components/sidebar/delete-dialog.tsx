"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  type AlertDialogHandle,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ChatSummary } from "./chats-provider";

/** Asks before chats are deleted for good. */
export function DeleteDialog({
  handle,
  landing,
  onDelete,
}: {
  handle: AlertDialogHandle<ChatSummary[]>;
  /** Where focus goes once they are deleted. */
  landing: React.RefObject<HTMLElement | null>;
  onDelete: (chats: ChatSummary[]) => void;
}) {
  return (
    <AlertDialog handle={handle}>
      {({ payload: chats = [] }) => (
        <AlertDialogContent finalFocus={landing}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chats.length === 1
                ? "Delete chat?"
                : `Delete ${chats.length} chats?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chats.length === 1
                ? `“${chats[0].title}” will be deleted for good.`
                : "They’ll be deleted for good."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => onDelete(chats)}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
