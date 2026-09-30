"use client";

import { SearchIcon, SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { openLink } from "@/components/chat/chat-cache";
import { Shortcut } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccountMenu, type User } from "./account-menu";
import { Chats } from "./chats";
import { HoverArea } from "./hover-area";
import { openSearch } from "./search-chats";

const navRow =
  "group/row relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13.5px] text-foreground/85 outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2 [&>svg]:size-4 [&>svg]:text-muted-foreground";
const hint =
  "ml-auto opacity-0 transition-opacity duration-150 group-hover/row:opacity-100";

export function AppSidebar({
  user,
  now,
  timeZone,
}: {
  /** Undefined when signed out, as on someone else's shared chat. */
  user?: User;
  /** When the server rendered, so both sides group chats by the same day. */
  now: number;
  timeZone: string;
}) {
  return (
    <>
      <div className="flex h-13 shrink-0 items-center justify-between pr-2 pl-4">
        <Link
          href="/"
          onNavigate={(event) => openLink(event, "/")}
          className="-ml-1 flex items-center gap-2 rounded-md px-1 py-0.5 text-[14px] font-medium tracking-[-0.01em] outline-offset-2 outline-ring focus-visible:outline-2"
        >
          <Logo />
          Bread Chat
        </Link>
        <SidebarTrigger className="max-md:hidden" />
      </div>

      <nav className="px-2 pb-1">
        <HoverArea className="flex flex-col gap-px">
          <Link
            data-row=""
            href="/"
            onNavigate={(event) => openLink(event, "/")}
            className={navRow}
          >
            <SquarePenIcon />
            New chat
            <Shortcut keys={["⇧", "O"]} className={hint} />
          </Link>
          <button
            type="button"
            data-row=""
            onClick={openSearch}
            className={navRow}
          >
            <SearchIcon />
            Search
            <Shortcut keys={["K"]} className={hint} />
          </button>
        </HoverArea>
      </nav>

      <Chats now={now} timeZone={timeZone}>
        <AccountMenu user={user} />
      </Chats>
    </>
  );
}
