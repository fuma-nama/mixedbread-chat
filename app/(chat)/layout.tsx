import { cookies } from "next/headers";
import { ModelsProvider } from "@/components/chat/models-provider";
import { SourcesProvider } from "@/components/chat/sources-provider";
import { AppSidebar, NewChatShortcut } from "@/components/sidebar/app-sidebar";
import { ChatsProvider } from "@/components/sidebar/chats-provider";
import { SearchChats } from "@/components/sidebar/search-chats";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { getChats } from "@/lib/db/queries";
import { listModels } from "@/lib/models";
import { getViewer } from "@/lib/viewer";
import { selectedSources } from "./model";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [viewer, cookieStore, selection, models] = await Promise.all([
    getViewer(),
    cookies(),
    selectedSources(),
    listModels(),
  ]);
  const chats = viewer ? await getChats(viewer.user.id) : [];

  return (
    <SidebarProvider
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      <ChatsProvider initialChats={chats}>
        <SourcesProvider
          organizations={viewer?.organizations ?? []}
          initialSelection={selection}
        >
          <ModelsProvider models={models}>
            <SearchChats>
              <NewChatShortcut />
              <Sidebar>
                <AppSidebar
                  user={
                    viewer && {
                      name: viewer.user.name,
                      email: viewer.user.email,
                      image: viewer.user.image,
                    }
                  }
                  // oxlint-disable-next-line react/purity -- rendered once per request
                  now={Date.now()}
                  timeZone={timeZoneOf(cookieStore.get("tz")?.value)}
                />
              </Sidebar>
              <SidebarInset>{children}</SidebarInset>
            </SearchChats>
          </ModelsProvider>
        </SourcesProvider>
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
