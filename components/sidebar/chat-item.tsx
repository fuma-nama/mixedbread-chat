"use client";

import { cn } from "cn";
import { EllipsisIcon, PencilIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteChats, renameChat } from "@/app/(chat)/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { TypedText } from "@/components/ui/typed-text";
import { type ChatSummary, useChats } from "./chats-provider";

export function ChatItem({
  chat,
  active,
  fresh,
  onOpen,
}: {
  chat: ChatSummary;
  active: boolean;
  /** Listed after the page loaded, so it slides into place. */
  fresh: boolean;
  onOpen: (event: { preventDefault: () => void }, href: string) => void;
}) {
  const { update } = useChats();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The title the reader gave it, which shows at once instead of typing out.
  const [named, setNamed] = useState<string>();

  async function rename(title: string) {
    setRenaming(false);
    const next = title.trim();
    if (!next || next === chat.title) return;
    const previous = chat.title;
    setNamed(next);
    update(chat.id, { title: next });
    try {
      await renameChat(chat.id, next);
    } catch {
      setNamed(previous);
      update(chat.id, { title: previous });
      toast.add({ title: "Couldn’t rename the chat." });
    }
  }

  async function remove() {
    setDeleting(false);
    update(chat.id, null);
    if (active) router.push("/");
    await deleteChats([chat.id]);
    toast.add({ title: "Chat deleted" });
  }

  return (
    <li
      data-row=""
      className={cn(
        "group/item grid grid-cols-1 grid-rows-[1fr]",
        fresh &&
          "transition-[grid-template-rows,opacity] duration-400 ease-smooth motion-reduce:transition-none starting:grid-rows-[0fr] starting:opacity-0",
      )}
    >
      <div className="relative min-h-0">
        {renaming ? (
          <input
            aria-label="Chat title"
            defaultValue={chat.title}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by choosing Rename
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => void rename(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
            className="h-8 w-full rounded-lg bg-card px-2 text-[13.5px] shadow-[0_0_0_1px_var(--crust),0_0_0_3px_oklch(from_var(--crust)_l_c_h/0.15)] outline-none"
          />
        ) : (
          <Link
            href={`/c/${chat.id}`}
            onNavigate={(event) => onOpen(event, `/c/${chat.id}`)}
            aria-current={active ? "page" : undefined}
            className="flex h-8 items-center rounded-lg px-2 text-[13.5px] text-foreground/75 outline-offset-0 outline-ring transition-colors duration-150 group-hover/item:text-foreground group-has-aria-expanded/item:bg-[oklch(from_var(--foreground)_l_c_h/0.055)] focus-visible:outline-2 aria-[current=page]:bg-[oklch(from_var(--foreground)_l_c_h/0.075)] aria-[current=page]:text-foreground"
          >
            <span className="min-w-0 flex-1 overflow-hidden mask-r-from-[calc(100%-1.5rem)] whitespace-nowrap group-hover/item:mask-r-from-[calc(100%-3.25rem)] group-has-aria-expanded/item:mask-r-from-[calc(100%-3.25rem)] pointer-coarse:mask-r-from-[calc(100%-3.25rem)]">
              <TypedText text={chat.title} instant={chat.title === named} />
            </span>
          </Link>
        )}

        {!renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Chat options"
              className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 outline-offset-2 outline-ring transition-[opacity,background-color,color] duration-150 group-hover/item:opacity-100 hover:bg-soft hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground aria-expanded:opacity-100 pointer-coarse:opacity-100"
            >
              <EllipsisIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" sideOffset={8}>
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(true)}
              >
                <TrashIcon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{chat.title}” will be deleted for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
