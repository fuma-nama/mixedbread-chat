"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import { SearchIcon, SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { deleteChats } from "@/app/(chat)/actions";
import { Logo } from "@/components/brand/logo";
import { Kbd, KbdGroup, ModKey } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "@/components/ui/toast";
import { useWindowEvent } from "@/hooks/use-window-event";
import { AccountMenu } from "./account-menu";
import { ChatItem } from "./chat-item";
import { type ChatSummary, useChatList, useChats } from "./chats-provider";
import { DeleteDialog } from "./delete-dialog";
import { useOpenSearch } from "./search-chats";
import { SelectionBar } from "./selection-bar";

const NONE: ReadonlySet<string> = new Set();

/** A press on the list: how it began, and a long hold on a row in the making. */
interface Press {
  type: string;
  x: number;
  y: number;
  timer: number;
  row?: HTMLElement;
  /** It became a long hold, so the click that ends it neither opens nor toggles. */
  held?: boolean;
}

export function AppSidebar({
  user,
  now,
  timeZone,
}: {
  /** Undefined when signed out, as on someone else's shared chat. */
  user?: { name: string; email: string; image?: string | null };
  /** When the server rendered, so both sides group chats by the same day. */
  now: number;
  timeZone: string;
}) {
  const chats = useChatList();
  const { remove, refresh } = useChats();
  const pathname = usePathname();
  const router = useRouter();
  const openSearch = useOpenSearch();
  // The chat being opened shows as open from the click, not from its arrival.
  const [activeId, setActiveId] = useOptimistic(chatIdOf(pathname));
  const [selection, setSelection] = useState(NONE);
  // Where Shift ranges start, and the selection they add to.
  const pivot = useRef<{ id?: string; base: ReadonlySet<string> }>({
    base: NONE,
  });
  const press = useRef<Press>({ type: "", x: 0, y: 0, timer: 0 });
  // The chats the delete dialog asks about.
  const [deleting, setDeleting] = useState<ChatSummary[]>();
  // Where focus lands once the chats around it are deleted.
  const landing = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);

  // The selected chats still listed, in the list's order.
  const selected: ChatSummary[] = [];
  for (const chat of chats) if (selection.has(chat.id)) selected.push(chat);
  const selecting = selected.length > 0;

  // Lets the server group chats by the reader's own days on the next load.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone !== timeZone) {
      void cookieStore.set({
        name: "tz",
        value: zone,
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
    }
  }, [timeZone]);

  function open(event: { preventDefault: () => void }, href: string) {
    event.preventDefault();
    startTransition(() => {
      setActiveId(chatIdOf(href));
      router.push(href);
    });
  }

  function rowOf(id: string | undefined) {
    return id
      ? area.current?.querySelector<HTMLElement>(`a[data-id="${id}"]`)
      : undefined;
  }

  /** Selects or unselects a chat, which then anchors the next range. */
  function toggle(id: string, on = !selection.has(id)) {
    const next = new Set(selection);
    if (on) next.add(id);
    else next.delete(id);
    pivot.current = { id, base: next };
    setSelection(next);
  }

  /** Selects the chats from the anchor to `id`, over what it anchored. */
  function extend(id: string) {
    const to = chats.findIndex((chat) => chat.id === id);
    let from = chats.findIndex((chat) => chat.id === pivot.current.id);
    if (from === -1) {
      // Without one, the range starts at the open chat, or at this one.
      from = chats.findIndex((chat) => chat.id === activeId);
      if (from === -1) from = to;
      pivot.current = { id: chats[from].id, base: selection };
    }
    const next = new Set(pivot.current.base);
    const [start, end] = from < to ? [from, to] : [to, from];
    for (let i = start; i <= end; i++) next.add(chats[i].id);
    setSelection(next);
  }

  function clear() {
    pivot.current = { base: NONE };
    setSelection(NONE);
  }

  // The bar goes with the selection, so focus in it goes back to the chats.
  function leave() {
    if (!document.activeElement?.closest("[data-id]")) {
      rowOf(pivot.current.id ?? selected[0]?.id)?.focus({
        preventScroll: true,
      });
    }
    clear();
  }

  function release() {
    const { timer, row } = press.current;
    clearTimeout(timer);
    press.current.timer = 0;
    if (row) delete row.dataset.holding;
  }

  /** A finger held on a row selects it, and taps toggle from then on. */
  function hold() {
    const { row, held } = press.current;
    if (!row?.dataset.id || held) return;
    release();
    press.current.held = true;
    navigator.vibrate?.(8);
    toggle(row.dataset.id, true);
  }

  function onPointerDown(event: React.PointerEvent) {
    const row =
      (event.target as Element).closest<HTMLElement>("a[data-id]") ?? undefined;
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
  }

  function onPointerMove(event: React.PointerEvent) {
    const { timer, x, y } = press.current;
    if (timer && Math.hypot(event.clientX - x, event.clientY - y) > 8) {
      release();
    }
  }

  // Android opens the link's own menu on a long press, before or after the timer.
  function onContextMenu(event: React.MouseEvent) {
    if (press.current.type === "mouse" || !press.current.row) return;
    event.preventDefault();
    hold();
  }

  function onClickCapture(event: React.MouseEvent) {
    if (press.current.held && event.detail > 0) {
      // The click a long hold ends with.
      press.current.held = false;
      event.preventDefault();
      return;
    }
    const target = event.target as Element;
    const row = target.closest<HTMLElement>("a[data-id]");
    const id = row?.dataset.id;
    if (!row || !id) {
      // Empty space around the rows, as in Finder.
      if (!target.closest("[data-row]")) clear();
      return;
    }
    // While chats are selected, a finger's tap toggles rather than opens.
    const tap = selecting && event.detail > 0 && press.current.type !== "mouse";
    if (event.metaKey || event.ctrlKey || tap) toggle(id);
    else if (event.shiftKey) extend(id);
    else {
      // A plain click opens it.
      clear();
      return;
    }
    event.preventDefault();
    // Safari leaves a clicked link unfocused, and keys act on focus.
    row.focus({ preventScroll: true });
  }

  function askToDelete(targets: ChatSummary[]) {
    landing.current = null;
    setDeleting(targets);
  }

  async function deleteForGood(targets: ChatSummary[]) {
    setDeleting(undefined);
    const ids = new Set(targets.map((chat) => chat.id));
    landing.current = rowOf(successor(chats, ids)) ?? null;
    const restore = remove(ids);
    const previous = selection;
    clear();
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
      setSelection(previous);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    // Space is the keyboard's Cmd-click, and Shift+Space its Shift-click.
    const id = event.target instanceof HTMLElement && event.target.dataset.id;
    if (event.key === " " && id) {
      event.preventDefault();
      if (event.repeat) return;
      if (event.shiftKey) extend(id);
      else toggle(id);
    }
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setSelection(new Set(chats.map((chat) => chat.id)));
    }
    if (!selecting) return;
    if (event.key === "Escape") leave();
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      askToDelete(selected);
    }
  }

  return (
    <>
      <div className="flex h-13 shrink-0 items-center justify-between pr-2 pl-4">
        <Link
          href="/"
          onNavigate={(event) => open(event, "/")}
          className="-ml-1 flex items-center gap-2 rounded-md px-1 py-0.5 text-[14px] font-medium tracking-[-0.01em] outline-offset-2 outline-ring focus-visible:outline-2"
        >
          <Logo />
          Bread Chat
        </Link>
        <SidebarTrigger className="max-md:hidden" />
      </div>

      <nav className="px-2 pb-1">
        <HoverArea className="flex flex-col gap-px">
          <NavRow
            data-row=""
            render={<Link href="/" onNavigate={(event) => open(event, "/")} />}
            keys={["⇧", "O"]}
          >
            <SquarePenIcon />
            New chat
          </NavRow>
          <NavRow data-row="" onClick={openSearch} keys={["K"]}>
            <SearchIcon />
            Search
          </NavRow>
        </HoverArea>
      </nav>

      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- keys for the chats inside */}
      <div ref={area} onKeyDown={onKeyDown} className="contents">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onContextMenu={onContextMenu}
          onClickCapture={onClickCapture}
          className="min-h-0 flex-1 scroll-fade-y scrollbar-thin overflow-y-auto overscroll-contain px-2 pb-4 outline-offset-2 outline-ring [--scroll-fade-size:1.5rem] [--selected:oklch(from_var(--honey)_l_c_h/0.3)] focus-visible:outline-2 dark:[--selected:oklch(from_var(--honey)_l_c_h/0.2)]"
        >
          <ChatList
            chats={chats}
            now={now}
            timeZone={timeZone}
            activeId={activeId}
            selection={selecting ? selection : undefined}
            onOpen={open}
            onDelete={(chat) => askToDelete([chat])}
          />
        </div>

        <SelectionBar
          count={selected.length}
          onClear={leave}
          onDelete={() => askToDelete(selected)}
        >
          <AccountMenu user={user} />
        </SelectionBar>
      </div>

      <DeleteDialog
        chats={deleting}
        landing={landing}
        onCancel={() => setDeleting(undefined)}
        onDelete={(targets) => void deleteForGood(targets)}
      />
    </>
  );
}

function NavRow({
  render,
  keys,
  children,
  ...props
}: useRender.ComponentProps<"button"> & {
  /** Keys after the platform's modifier. */
  keys: string[];
}) {
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(
      {
        className:
          "group/row relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13.5px] text-foreground/85 outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2 [&>svg]:size-4 [&>svg]:text-muted-foreground",
        children: (
          <>
            {children}
            <KbdGroup className="ml-auto opacity-0 transition-opacity duration-150 group-hover/row:opacity-100">
              <ModKey />
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </>
        ),
      },
      props,
    ),
  });
}

/** ⌘⇧O starts a new chat. Mounted once, beside the sidebar. */
export function NewChatShortcut() {
  const router = useRouter();

  useWindowEvent("keydown", (event) => {
    if (
      event.key.toLowerCase() === "o" &&
      event.shiftKey &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      router.push("/");
    }
  });

  return null;
}

/**
 * Rows with a soft block that glides to whichever one the mouse is over (or
 * keyboard focus is on) and fades once the pointer leaves. Rows are the
 * `[data-row]` elements inside; they need a position so they paint above it.
 */
function HoverArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div ref={follow} className={cn("relative", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-[oklch(from_var(--foreground)_l_c_h/0.055)] opacity-0 transition-opacity duration-200 ease-smooth motion-safe:data-glide:transition-[translate,height,opacity]"
      />
      {children}
    </div>
  );
}

/** Moves the area's block, its first child, to the row being pointed at. */
function follow(area: HTMLDivElement | null) {
  const block = area?.firstElementChild;
  if (!area || !(block instanceof HTMLElement)) return;
  let current: HTMLElement | null = null;

  const show = (row: HTMLElement | null) => {
    if (row === current) return;
    // From another row it glides; arriving from outside it appears in place.
    block.toggleAttribute("data-glide", current !== null);
    current = row;
    if (!row) {
      block.style.opacity = "0";
      return;
    }
    const top =
      row.getBoundingClientRect().top - area.getBoundingClientRect().top;
    block.style.translate = `0 ${top}px`;
    block.style.height = `${row.offsetHeight}px`;
    block.style.opacity = "1";
  };
  const rowOf = (target: EventTarget | null) =>
    target instanceof Element
      ? target.closest<HTMLElement>("[data-row]")
      : null;

  // Over a heading or a gap, it holds its place instead of flickering off.
  const onOver = (event: PointerEvent) => {
    const row = rowOf(event.target);
    if (row && event.pointerType === "mouse") show(row);
  };
  const onLeave = () => show(null);
  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof Element && target.matches(":focus-visible")) {
      show(rowOf(target));
    }
  };
  const onBlur = () => {
    if (!area.matches(":hover")) show(null);
  };
  area.addEventListener("pointerover", onOver);
  area.addEventListener("pointerleave", onLeave);
  area.addEventListener("focusin", onFocus);
  area.addEventListener("focusout", onBlur);
  return () => {
    area.removeEventListener("pointerover", onOver);
    area.removeEventListener("pointerleave", onLeave);
    area.removeEventListener("focusin", onFocus);
    area.removeEventListener("focusout", onBlur);
  };
}

/** Chats by day. */
function ChatList({
  chats,
  now,
  timeZone,
  activeId,
  selection,
  onOpen,
  onDelete,
}: {
  chats: ChatSummary[];
  now: number;
  timeZone: string;
  activeId?: string;
  /** The selected chats, while some are. */
  selection?: ReadonlySet<string>;
  onOpen: (event: { preventDefault: () => void }, href: string) => void;
  onDelete: (chat: ChatSummary) => void;
}) {
  const groups = useMemo(
    () => groupByDay(chats, now, timeZone),
    [chats, now, timeZone],
  );
  // Chats listed later than this slide in; the ones a page loads with do not.
  const [listed] = useState(() => new Set(chats.map((chat) => chat.id)));

  return (
    <HoverArea>
      {groups.map((group) => (
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
                selected={selection?.has(chat.id)}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </HoverArea>
  );
}

function chatIdOf(pathname: string): string | undefined {
  return pathname.match(/^\/c\/([^/]+)/)?.[1];
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
