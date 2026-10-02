"use client";

import { cn } from "cn";
import { TrashIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { deleteChats } from "@/app/(chat)/actions";
import {
  type ChatSummary,
  changeChats,
  chatKey,
  navigate,
  refreshChats,
  useChatList,
} from "@/components/chat/chat-cache";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  createAlertDialogHandle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { remember } from "@/lib/remember";
import { ChatItem } from "./chat-item";
import { HoverArea } from "./hover-area";

const deleteDialog = createAlertDialogHandle<ChatSummary[]>();

/** While chats are selected, the selection bar takes the place of `children`. */
export function Chats({
  now,
  timeZone,
  children,
}: {
  now: number;
  timeZone: string;
  children: React.ReactNode;
}) {
  const activeId = usePathname().match(/^\/c\/([^/]+)/)?.[1];
  const chats = useChatList();
  const selection = useSelection(chats, activeId);
  const hold = useHold((id) => selection.toggle(id, true));
  const [listed] = useState(() => new Set(chats.map((chat) => chat.id)));
  const landing = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { selected } = selection;
  const selecting = selected.length > 0;

  // Lets the server group chats by the reader's own days on the next load.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone !== timeZone) remember("tz", zone);
  }, [timeZone]);

  function askToDelete(targets: ChatSummary[]) {
    landing.current = null;
    deleteDialog.openWithPayload(targets);
  }

  function rowOf(id: string | undefined) {
    return id
      ? area.current?.querySelector<HTMLElement>(`a[data-id="${id}"]`)
      : undefined;
  }

  // The bar goes with the selection, so focus in it goes back to the chats.
  function leave() {
    if (!document.activeElement?.closest("[data-id]")) {
      rowOf(selection.anchor() ?? selected[0]?.id)?.focus({
        preventScroll: true,
      });
    }
    selection.clear();
  }

  function onClickCapture(event: React.MouseEvent) {
    if (hold.ended(event)) return;
    const target = event.target as Element;
    const row = target.closest<HTMLElement>("a[data-id]");
    const id = row?.dataset.id;
    if (!row || !id) {
      if (!target.closest("[data-row]")) selection.clear();
      return;
    }
    const tap = selecting && event.detail > 0 && hold.touch();
    if (event.metaKey || event.ctrlKey || tap) selection.toggle(id);
    else if (event.shiftKey) selection.extend(id);
    else {
      selection.clear();
      return;
    }
    event.preventDefault();
    // Safari leaves a clicked link unfocused, and keys act on focus.
    row.focus({ preventScroll: true });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // Keys from the menus and dialogs opened here bubble here past their portals.
    if (
      event.target instanceof HTMLInputElement ||
      !event.currentTarget.contains(event.target as Node)
    ) {
      return;
    }
    const id = event.target instanceof HTMLElement && event.target.dataset.id;
    if (event.key === " " && id) {
      event.preventDefault();
      if (event.repeat) return;
      if (event.shiftKey) selection.extend(id);
      else selection.toggle(id);
    }
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      selection.selectAll();
    }
    if (!selecting) return;
    if (event.key === "Escape") leave();
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      askToDelete(selected);
    }
  }

  async function deleteForGood(targets: ChatSummary[]) {
    const ids = new Set(targets.map((chat) => chat.id));
    landing.current = rowOf(successor(chats, ids)) ?? null;
    deleteDialog.close();
    const previous = selection.selection;
    selection.clear();
    for (const id of ids)
      void mutate(chatKey(id), undefined, { revalidate: false });
    if (activeId && ids.has(activeId)) navigate("/");
    const one = ids.size === 1;
    changeChats((list) => list.filter((chat) => !ids.has(chat.id)));
    try {
      await toast.promise(deleteChats(Array.from(ids)), {
        loading: "Deleting…",
        success: one ? "Chat deleted" : `${ids.size} chats deleted`,
        error: one ? "Couldn’t delete the chat." : "Couldn’t delete the chats.",
      });
      // Older chats move up into the room the deleted ones left.
      refreshChats();
    } catch {
      changeChats(() => chats);
      selection.restore(previous);
    }
  }

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- keys for the chats inside */}
      <div ref={area} onKeyDown={onKeyDown} className="contents">
        <div
          {...hold.handlers}
          onClickCapture={onClickCapture}
          className="min-h-0 flex-1 scroll-fade-y scrollbar-thin overflow-y-auto overscroll-contain px-2 pb-4 outline-offset-2 outline-ring [--scroll-fade-size:1.5rem] [--selected:oklch(from_var(--honey)_l_c_h/0.3)] focus-visible:outline-2 dark:[--selected:oklch(from_var(--honey)_l_c_h/0.2)]"
        >
          <HoverArea>
            {groupByDay(chats, now, timeZone).map((group) => (
              <section key={group.label} className="pt-4 first:pt-2">
                <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground/80">
                  {group.label}
                </h3>
                <ul className="flex flex-col gap-px">
                  {group.chats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      active={chat.id === activeId}
                      fresh={!listed.has(chat.id)}
                      selected={
                        selecting ? selection.selection.has(chat.id) : undefined
                      }
                      onDelete={askToDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </HoverArea>
        </div>

        <SelectionBar
          count={selected.length}
          onClear={leave}
          onDelete={() => askToDelete(selected)}
        >
          {children}
        </SelectionBar>
      </div>

      <AlertDialog handle={deleteDialog}>
        {({ payload: targets = [] }) => (
          <AlertDialogContent finalFocus={landing}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {targets.length === 1
                  ? "Delete chat?"
                  : `Delete ${targets.length} chats?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {targets.length === 1
                  ? `“${targets[0].title}” will be deleted for good.`
                  : "They’ll be deleted for good."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => void deleteForGood(targets)}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}

function successor(chats: ChatSummary[], ids: ReadonlySet<string>) {
  let above: string | undefined;
  let passed = false;
  for (const chat of chats) {
    if (ids.has(chat.id)) passed = true;
    else if (passed) return chat.id;
    else above = chat.id;
  }
  return above;
}

const DAY = 24 * 60 * 60 * 1000;

function groupByDay(chats: ChatSummary[], now: number, timeZone: string) {
  // Midnight of each day on the reader's calendar, as a UTC timestamp.
  const format = new Intl.DateTimeFormat("en-CA", { timeZone });
  const dayOf = (time: number | Date) => Date.parse(format.format(time));
  const today = dayOf(now);

  const groups: { label: string; chats: ChatSummary[] }[] = [];
  for (const chat of chats) {
    const days = Math.round((today - dayOf(chat.updatedAt)) / DAY);
    const label =
      days <= 0
        ? "Today"
        : days === 1
          ? "Yesterday"
          : days < 7
            ? "Previous 7 days"
            : days < 30
              ? "Previous 30 days"
              : "Older";
    const last = groups.at(-1);
    if (last?.label === label) last.chats.push(chat);
    else groups.push({ label, chats: [chat] });
  }
  return groups;
}

const NONE: ReadonlySet<string> = new Set();

// A toggle anchors the next range, and a range adds to what was picked before it.
function useSelection(chats: ChatSummary[], activeId?: string) {
  const [selection, setSelection] = useState(NONE);
  const anchor = useRef<{ id?: string; base: ReadonlySet<string> }>({
    base: NONE,
  });

  const selected = chats.filter((chat) => selection.has(chat.id));

  return {
    selection,
    selected,
    toggle(id: string, on?: boolean) {
      const next = new Set(selection);
      if (on ?? !selection.has(id)) next.add(id);
      else next.delete(id);
      anchor.current = { id, base: next };
      setSelection(next);
    },
    extend(id: string) {
      const to = chats.findIndex((chat) => chat.id === id);
      let from = chats.findIndex((chat) => chat.id === anchor.current.id);
      if (from === -1) {
        from = chats.findIndex((chat) => chat.id === activeId);
        if (from === -1) from = to;
        anchor.current = { id: chats[from].id, base: selection };
      }
      const next = new Set(anchor.current.base);
      const [start, end] = from < to ? [from, to] : [to, from];
      for (let i = start; i <= end; i++) next.add(chats[i].id);
      setSelection(next);
    },
    selectAll() {
      setSelection(new Set(chats.map((chat) => chat.id)));
    },
    clear() {
      anchor.current = { base: NONE };
      setSelection(NONE);
    },
    restore: setSelection,
    anchor: () => anchor.current.id,
  };
}

interface Press {
  type: string;
  x: number;
  y: number;
  timer: number;
  row?: HTMLElement;
  held?: boolean;
}

function useHold(onHold: (id: string) => void) {
  const press = useRef<Press>({ type: "", x: 0, y: 0, timer: 0 });

  function release() {
    const { timer, row } = press.current;
    clearTimeout(timer);
    press.current.timer = 0;
    if (row) delete row.dataset.holding;
  }

  function hold() {
    const { row, held } = press.current;
    if (!row?.dataset.id || held) return;
    release();
    press.current.held = true;
    navigator.vibrate?.(8);
    onHold(row.dataset.id);
  }

  return {
    handlers: {
      onPointerDown(event: React.PointerEvent) {
        const row =
          (event.target as Element).closest<HTMLElement>("a[data-id]") ??
          undefined;
        press.current = {
          type: event.pointerType,
          x: event.clientX,
          y: event.clientY,
          timer: 0,
          row,
        };
        if (!row || event.pointerType === "mouse") return;
        row.dataset.holding = "";
        press.current.timer = window.setTimeout(hold, 450);
      },
      onPointerMove(event: React.PointerEvent) {
        const { timer, x, y } = press.current;
        if (timer && Math.hypot(event.clientX - x, event.clientY - y) > 8) {
          release();
        }
      },
      onPointerUp: release,
      onPointerCancel: release,
      // Android opens the link's own menu on a long press, before or after the timer.
      onContextMenu(event: React.MouseEvent) {
        if (press.current.type === "mouse" || !press.current.row) return;
        event.preventDefault();
        hold();
      },
    },
    touch: () => press.current.type !== "mouse",
    /** Swallows the click a hold ends with, and says whether `event` was it. */
    ended(event: React.MouseEvent) {
      if (!press.current.held || event.detail === 0) return false;
      press.current.held = false;
      event.preventDefault();
      return true;
    },
  };
}

const layer =
  "col-start-1 row-start-1 transition-[opacity,translate] duration-200 ease-smooth motion-reduce:transition-none";
const away = "translate-y-1 opacity-0";

/** The count holds as the bar fades out. */
function SelectionBar({
  count,
  onClear,
  onDelete,
  children,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState({ count, roll: 1 });
  if (count && count !== shown.count) {
    setShown({ count, roll: count > shown.count ? 1 : -1 });
  }

  return (
    <div className="grid shrink-0 p-2">
      <div inert={count > 0} className={cn(layer, count > 0 && away)}>
        {children}
      </div>
      <div
        inert={!count}
        className={cn(layer, "flex h-10 items-center gap-0.5", !count && away)}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear selection"
                className="text-muted-foreground"
                onClick={onClear}
              />
            }
          >
            <XIcon />
          </TooltipTrigger>
          <TooltipContent>
            Clear selection
            <Kbd>Esc</Kbd>
          </TooltipContent>
        </Tooltip>
        <span className="min-w-0 flex-1 truncate text-[13.5px] tabular-nums">
          <span
            key={shown.count}
            style={{ "--roll": shown.roll } as React.CSSProperties}
            className="inline-block motion-safe:animate-roll-in"
          >
            {shown.count}
          </span>{" "}
          selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-keyshortcuts="Delete"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <TrashIcon />
          Delete
        </Button>
      </div>
      <p role="status" className="sr-only">
        {count ? `${count} selected` : ""}
      </p>
    </div>
  );
}
