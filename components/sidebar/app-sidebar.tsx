"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { SearchIcon, SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useOptimistic } from "react";
import { Logo } from "@/components/brand/logo";
import { Kbd, KbdGroup, ModKey } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useWindowEvent } from "@/hooks/use-window-event";
import { AccountMenu } from "./account-menu";
import { Chats } from "./chats";
import { HoverArea } from "./hover-area";
import { useOpenSearch } from "./search-chats";

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
  const pathname = usePathname();
  const router = useRouter();
  const openSearch = useOpenSearch();
  // The chat being opened shows as open from the click, not from its arrival.
  const [activeId, setActiveId] = useOptimistic(chatIdOf(pathname));

  const open = useCallback(
    (event: { preventDefault: () => void }, href: string) => {
      event.preventDefault();
      startTransition(() => {
        setActiveId(chatIdOf(href));
        router.push(href);
      });
    },
    [router, setActiveId],
  );

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

      <Chats now={now} timeZone={timeZone} activeId={activeId} onOpen={open}>
        <AccountMenu user={user} />
      </Chats>
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

function chatIdOf(pathname: string): string | undefined {
  return pathname.match(/^\/c\/([^/]+)/)?.[1];
}
