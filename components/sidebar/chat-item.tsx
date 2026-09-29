"use client";

import { cn } from "cn";
import {
  CheckIcon,
  EllipsisIcon,
  PencilIcon,
  SquareCheckIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { renameChat } from "@/app/(chat)/actions";
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
  selected,
  onOpen,
  onSelect,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  /** Listed after the page loaded, so it slides into place. */
  fresh: boolean;
  /** Whether it is selected; undefined while no chat is. */
  selected?: boolean;
  onOpen: (event: { preventDefault: () => void }, href: string) => void;
  /** Toggles it, or with `range`, selects every chat from the last one toggled. */
  onSelect: (id: string, range: boolean) => void;
  onDelete: (chat: ChatSummary) => void;
}) {
  const { update } = useChats();
  const [renaming, setRenaming] = useState(false);
  // The title the reader gave it, which shows at once instead of typing out.
  const [named, setNamed] = useState<string>();
  const link = useRef<HTMLAnchorElement>(null);
  const press = useLongPress(() => onSelect(chat.id, false));
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
      data-id={chat.id}
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
            ref={link}
            href={href}
            role={selecting ? "checkbox" : undefined}
            aria-checked={selected}
            aria-current={active && !selecting ? "page" : undefined}
            onNavigate={(event) => onOpen(event, href)}
            // While selecting, or with a modifier, a click selects rather than opens.
            onClick={(event) => {
              const { metaKey, ctrlKey, shiftKey } = event;
              if (!selecting && !metaKey && !ctrlKey && !shiftKey) return;
              event.preventDefault();
              // Safari leaves a clicked link unfocused, and Escape needs focus here.
              event.currentTarget.focus();
              onSelect(chat.id, shiftKey);
            }}
            onKeyDown={(event) => {
              if (!selecting || event.key !== " ") return;
              event.preventDefault();
              if (!event.repeat) onSelect(chat.id, event.shiftKey);
            }}
            {...press}
            className="group/chat relative flex h-8 items-center rounded-lg px-2 text-[13.5px] text-foreground/75 outline-offset-0 outline-ring transition-colors duration-150 select-none [-webkit-touch-callout:none] group-hover/item:text-foreground group-has-aria-expanded/item:bg-[oklch(from_var(--foreground)_l_c_h/0.055)] focus-visible:outline-2 aria-checked:text-foreground aria-[current=page]:bg-[oklch(from_var(--foreground)_l_c_h/0.075)] aria-[current=page]:text-foreground"
          >
            <Box shown={selecting} />
            <span
              className={cn(
                "min-w-0 flex-1 overflow-hidden mask-r-from-[calc(100%-1.5rem)] whitespace-nowrap",
                !selecting &&
                  "group-hover/item:mask-r-from-[calc(100%-3.25rem)] group-has-aria-expanded/item:mask-r-from-[calc(100%-3.25rem)] pointer-coarse:mask-r-from-[calc(100%-3.25rem)]",
              )}
            >
              {/* Slides over to make room for the box, under the nav's labels. */}
              <span
                className={cn(
                  "inline-block transition-[translate] duration-200 ease-smooth motion-reduce:transition-none",
                  selecting && "translate-x-6.5",
                )}
              >
                <TypedText text={chat.title} instant={chat.title === named} />
              </span>
            </span>
          </Link>
        )}

        {!renaming && !selecting && (
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
              <DropdownMenuItem
                onClick={() => {
                  onSelect(chat.id, false);
                  // The menu's button leaves with the menu; the row keeps focus.
                  requestAnimationFrame(() => link.current?.focus());
                }}
              >
                <SquareCheckIcon />
                Select
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(chat)}
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
}

/** The row's checkbox, there while chats are selected. The tick springs in. */
function Box({ shown }: { shown: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-y-0 left-2.25 my-auto grid size-3.5 place-items-center rounded-[4px] bg-card shadow-[inset_0_0_0_1.5px_var(--input)] transition-[background-color,box-shadow,opacity,scale] duration-200 ease-smooth group-aria-checked/chat:bg-primary group-aria-checked/chat:shadow-none motion-reduce:transition-none",
        !shown && "scale-50 opacity-0",
      )}
    >
      <CheckIcon
        strokeWidth={3}
        className="size-2.5 scale-50 text-primary-foreground opacity-0 transition-[scale,opacity] duration-200 ease-spring group-aria-checked/chat:scale-100 group-aria-checked/chat:opacity-100 motion-reduce:transition-none"
      />
    </span>
  );
}

/**
 * A finger resting on the row selects it, in place of the tap and the link's
 * own menu that would follow.
 */
function useLongPress(onPress: () => void) {
  const press = useRef({ x: 0, y: 0, timer: 0, touch: false, fired: false });
  const cancel = () => clearTimeout(press.current.timer);
  const fire = () => {
    cancel();
    if (press.current.fired) return;
    press.current.fired = true;
    onPress();
  };

  return {
    onPointerDown(event: React.PointerEvent) {
      const touch = event.pointerType === "touch";
      press.current = {
        x: event.clientX,
        y: event.clientY,
        timer: touch ? window.setTimeout(fire, 450) : 0,
        touch,
        fired: false,
      };
    },
    // A finger on its way somewhere, like swiping the drawer shut.
    onPointerMove(event: React.PointerEvent) {
      const { x, y } = press.current;
      if (Math.hypot(event.clientX - x, event.clientY - y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Android opens the link's menu on a long press, before or after the timer.
    onContextMenu(event: React.MouseEvent) {
      if (!press.current.touch) return;
      event.preventDefault();
      fire();
    },
    onClickCapture(event: React.MouseEvent) {
      if (!press.current.fired) return;
      press.current.fired = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
