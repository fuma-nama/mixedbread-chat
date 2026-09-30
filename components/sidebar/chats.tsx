"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { deleteChats } from "@/app/(chat)/actions";
import { chatKey, navigate } from "@/components/chat/chat-cache";
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
import { toast } from "@/components/ui/toast";
import { remember } from "@/lib/remember";
import { ChatItem } from "./chat-item";
import { type ChatSummary, useChatList, useChats } from "./chats-provider";
import { HoverArea } from "./hover-area";
import { SelectionBar } from "./selection-bar";
import { useHold } from "./use-hold";
import { useSelection } from "./use-selection";

/**
 * The chats by day, selected the way desktop lists select. While any are,
 * the selection bar takes the place of `children`, the account row.
 */
export function Chats({
  now,
  timeZone,
  activeId,
  children,
}: {
  now: number;
  timeZone: string;
  activeId?: string;
  children: React.ReactNode;
}) {
  const chats = useChatList();
  const { remove, refresh } = useChats();
  const selection = useSelection(chats, activeId);
  const hold = useHold((id) => selection.toggle(id, true));
  const [dialog] = useState(() => createAlertDialogHandle<ChatSummary[]>());
  // Chats listed later than this slide in; the ones a page loads with do not.
  const [listed] = useState(() => new Set(chats.map((chat) => chat.id)));
  // Where focus lands once the chats around it are deleted.
  const landing = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const askToDelete = useCallback(
    (targets: ChatSummary[]) => {
      landing.current = null;
      dialog.openWithPayload(targets);
    },
    [dialog],
  );
  const { selected } = selection;
  const selecting = selected.length > 0;

  // Lets the server group chats by the reader's own days on the next load.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone !== timeZone) remember("tz", zone);
  }, [timeZone]);

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
      // Empty space around the rows, as in Finder.
      if (!target.closest("[data-row]")) selection.clear();
      return;
    }
    // While chats are selected, a finger's tap toggles rather than opens.
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
    // Space is the keyboard's Cmd-click, and Shift+Space its Shift-click.
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
    dialog.close();
    const restore = remove(ids);
    const previous = selection.selection;
    selection.clear();
    for (const id of ids)
      void mutate(chatKey(id), undefined, { revalidate: false });
    if (activeId && ids.has(activeId)) navigate("/");
    const one = ids.size === 1;
    try {
      await toast.promise(deleteChats(Array.from(ids)), {
        loading: "Deleting…",
        success: one ? "Chat deleted" : `${ids.size} chats deleted`,
        error: one ? "Couldn’t delete the chat." : "Couldn’t delete the chats.",
      });
      // Older chats move up into the room they left.
      refresh();
    } catch {
      restore();
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

      <AlertDialog handle={dialog}>
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

/** The chat that takes the place of the first of `ids`, or the one above it. */
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
  const dayOf = (time: number) => Date.parse(format.format(time));
  const today = dayOf(now);

  const groups: { label: string; chats: ChatSummary[] }[] = [];
  for (const chat of chats) {
    const days = Math.round((today - dayOf(chat.updatedAt.getTime())) / DAY);
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
