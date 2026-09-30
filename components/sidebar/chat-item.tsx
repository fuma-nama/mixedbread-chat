"use client";

import { cn } from "cn";
import { EllipsisIcon, PencilIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { memo, useRef, useState } from "react";
import { preload } from "swr";
import { renameChat } from "@/app/(chat)/actions";
import { chatKey, fetchChat, openLink } from "@/components/chat/chat-cache";
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

/** Memoized, so a click re-renders only the rows it changes. */
export const ChatItem = memo(function ChatItem({
  chat,
  active,
  fresh,
  selected,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  /** Listed after the page loaded, so it slides into place. */
  fresh: boolean;
  /** Undefined while no chat is selected. */
  selected?: boolean;
  onDelete: (chats: ChatSummary[]) => void;
}) {
  const { update } = useChats();
  const [renaming, setRenaming] = useState(false);
  // Renaming ended from the keyboard, so the row takes focus back.
  const refocus = useRef(false);
  // The title the reader gave it, which shows at once instead of typing out.
  const [named, setNamed] = useState<string>();
  const selecting = selected !== undefined;
  const href = `/c/${chat.id}`;

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

  return (
    <li
      data-row=""
      data-selected={selected || undefined}
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
              if (event.key !== "Enter" && event.key !== "Escape") return;
              refocus.current = true;
              if (event.key === "Enter") event.currentTarget.blur();
              else setRenaming(false);
            }}
            className="h-8 w-full rounded-lg bg-card px-2 text-[13.5px] shadow-[0_0_0_1px_var(--crust),0_0_0_3px_oklch(from_var(--crust)_l_c_h/0.15)] outline-none"
          />
        ) : (
          <Link
            ref={(link) => {
              if (!link || !refocus.current) return;
              refocus.current = false;
              link.focus();
            }}
            href={href}
            data-id={chat.id}
            aria-current={active ? "page" : undefined}
            onNavigate={(event) => openLink(event, href)}
            onPointerEnter={() => void preload(chatKey(chat.id), fetchChat)}
            className={cn(
              // Selected neighbors join into one block, square where they meet.
              "flex h-8 items-center rounded-lg px-2 text-[13.5px] text-foreground/75 outline-offset-0 outline-ring transition-[color,background-color,border-radius,box-shadow,scale] duration-200 ease-[var(--ease-smooth),var(--ease-smooth),var(--ease-smooth),var(--ease-smooth),var(--ease-spring)] select-none [-webkit-touch-callout:none] group-hover/item:text-foreground group-has-aria-expanded/item:bg-[oklch(from_var(--foreground)_l_c_h/0.055)] focus-visible:outline-2 in-[[data-selected]+[data-selected]]:rounded-t-none in-[[data-selected]:has(+[data-selected])]:rounded-b-none in-[[data-selected]:has(+[data-selected])]:shadow-[0_1px_var(--selected)] motion-reduce:transition-none",
              // A finger resting on it presses it in as the fill builds, past a tap's length.
              "data-holding:delay-100 data-holding:duration-350 data-holding:ease-linear motion-safe:data-holding:scale-[0.98] motion-safe:data-holding:bg-(--selected)",
              selected
                ? "bg-(--selected) text-foreground"
                : "aria-[current=page]:bg-[oklch(from_var(--foreground)_l_c_h/0.075)] aria-[current=page]:text-foreground",
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 overflow-hidden mask-r-from-[calc(100%-1.5rem)] whitespace-nowrap",
                !selecting &&
                  "group-hover/item:mask-r-from-[calc(100%-3.25rem)] group-has-aria-expanded/item:mask-r-from-[calc(100%-3.25rem)] pointer-coarse:mask-r-from-[calc(100%-3.25rem)]",
              )}
            >
              <TypedText text={chat.title} instant={chat.title === named} />
            </span>
            {selected && <span className="sr-only">, selected</span>}
          </Link>
        )}

        {!selecting && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Chat options"
              className={cn(
                "absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 outline-offset-2 outline-ring transition-[opacity,background-color,color] duration-150 group-hover/item:opacity-100 hover:bg-soft hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground aria-expanded:opacity-100 pointer-coarse:opacity-100",
                // Hidden rather than gone, so the menu Rename closes keeps its
                // place and leaves focus in the title field.
                renaming && "invisible",
              )}
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
                onClick={() => onDelete([chat])}
              >
                <TrashIcon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
});
