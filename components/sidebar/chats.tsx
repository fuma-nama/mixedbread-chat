"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { deleteChats } from "@/app/(chat)/actions";
import { createAlertDialogHandle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { ChatList } from "./chat-list";
import { type ChatSummary, useChatList, useChats } from "./chats-provider";
import { DeleteDialog } from "./delete-dialog";
import { SelectionBar } from "./selection-bar";
import { useHold } from "./use-hold";
import { useSelection } from "./use-selection";

/**
 * The chats, selected the way desktop lists select. While any are, the
 * selection bar takes the place of `children`, the account row.
 */
export function Chats({
  now,
  timeZone,
  activeId,
  onOpen,
  children,
}: {
  now: number;
  timeZone: string;
  activeId?: string;
  onOpen: (event: { preventDefault: () => void }, href: string) => void;
  children: React.ReactNode;
}) {
  const chats = useChatList();
  const { remove, refresh } = useChats();
  const router = useRouter();
  const selection = useSelection(chats, activeId);
  const hold = useHold((id) => selection.toggle(id, true));
  const [dialog] = useState(() => createAlertDialogHandle<ChatSummary[]>());
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
      // A plain click opens it.
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
    if (activeId && ids.has(activeId)) router.push("/");
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
          <ChatList
            chats={chats}
            now={now}
            timeZone={timeZone}
            activeId={activeId}
            selection={selecting ? selection.selection : undefined}
            onOpen={onOpen}
            onDelete={askToDelete}
          />
        </div>

        <SelectionBar
          count={selected.length}
          onClear={leave}
          onDelete={() => askToDelete(selected)}
        >
          {children}
        </SelectionBar>
      </div>

      <DeleteDialog
        handle={dialog}
        landing={landing}
        onDelete={(targets) => void deleteForGood(targets)}
      />
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
