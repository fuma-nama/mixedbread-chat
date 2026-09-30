import { useRef, useState } from "react";
import type { ChatSummary } from "./chats-provider";

const NONE: ReadonlySet<string> = new Set();

// A toggle anchors the next range, and a range adds to what was picked before it.
export function useSelection(chats: ChatSummary[], activeId?: string) {
  const [selection, setSelection] = useState(NONE);
  // Where ranges start, and the selection they add to.
  const anchor = useRef<{ id?: string; base: ReadonlySet<string> }>({
    base: NONE,
  });

  const selected: ChatSummary[] = [];
  for (const chat of chats) if (selection.has(chat.id)) selected.push(chat);

  return {
    selection,
    selected,
    /** Selects or unselects a chat, which then anchors the next range. */
    toggle(id: string, on = !selection.has(id)) {
      const next = new Set(selection);
      if (on) next.add(id);
      else next.delete(id);
      anchor.current = { id, base: next };
      setSelection(next);
    },
    /** Selects the chats from the anchor to `id`, over what it anchored. */
    extend(id: string) {
      const to = chats.findIndex((chat) => chat.id === id);
      let from = chats.findIndex((chat) => chat.id === anchor.current.id);
      if (from === -1) {
        // Without one, the range starts at the open chat, or at this one.
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
    /** The chat the next range starts from. */
    anchor: () => anchor.current.id,
  };
}
