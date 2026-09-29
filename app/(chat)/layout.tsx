import { cookies } from "next/headers";
import { AppSidebar, NewChatShortcut } from "@/components/sidebar/app-sidebar";
import { ChatsProvider } from "@/components/sidebar/chats-provider";
import { SearchChats } from "@/components/sidebar/search-chats";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { getSession } from "@/lib/auth";
import { getChats } from "@/lib/db/queries";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  const chats = session ? await getChats(session.user.id) : [];

  return (
    <SidebarProvider
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      <ChatsProvider
        initialChats={chats}
        guest={!session || Boolean(session.user.isAnonymous)}
      >
        <SearchChats>
          <NewChatShortcut />
          <Sidebar>
            <AppSidebar
              user={
                session && !session.user.isAnonymous
                  ? { name: session.user.name, email: session.user.email }
                  : undefined
              }
              // oxlint-disable-next-line react/purity -- rendered once per request
              now={Date.now()}
              timeZone={timeZoneOf(cookieStore.get("tz")?.value)}
            />
          </Sidebar>
          <SidebarInset>{children}</SidebarInset>
        </SearchChats>
      </ChatsProvider>
    </SidebarProvider>
  );
}

/** The reader's time zone, remembered by the sidebar; UTC until it is. */
function timeZoneOf(value: string | undefined): string {
  if (!value) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: decodeURIComponent(value),
    }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
