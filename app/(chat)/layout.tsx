import { cookies } from "next/headers";
import { ModelsProvider } from "@/components/chat/models-provider";
import { SourcesProvider } from "@/components/chat/sources-provider";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ChatsProvider } from "@/components/sidebar/chats-provider";
import { SearchChats } from "@/components/sidebar/search-chats";
import { StoreProvider } from "@/components/store-provider";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { getSession } from "@/lib/auth";
import { getChats } from "@/lib/db/queries";
import { defaultModel, listModels } from "@/lib/models";
import { defaultReasoning, isReasoning } from "@/lib/reasoning";
import { parseSelection, SELECTION_COOKIE } from "@/lib/sources";
import { getViewer } from "@/lib/viewer";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [viewer, cookieStore, models, chats] = await Promise.all([
    getViewer(),
    cookies(),
    listModels(),
    // Chats need only the session, not the viewer's connections.
    getSession().then((session) => (session ? getChats(session.user.id) : [])),
  ]);
  // The model and effort picked last, remembered by their pickers.
  const model = cookieStore.get("model")?.value;
  const reasoning = cookieStore.get("reasoning")?.value;

  return (
    <SidebarProvider
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      <StoreProvider>
        <ChatsProvider initialChats={viewer ? chats : []}>
          <SourcesProvider
            organizations={viewer?.organizations ?? []}
            initialSelection={parseSelection(
              cookieStore.get(SELECTION_COOKIE)?.value,
            )}
          >
            <ModelsProvider
              models={models}
              model={
                models.find((entry) => entry.id === model)?.id ?? defaultModel
              }
              reasoning={isReasoning(reasoning) ? reasoning : defaultReasoning}
            >
              <SearchChats />
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
            </ModelsProvider>
          </SourcesProvider>
        </ChatsProvider>
      </StoreProvider>
    </SidebarProvider>
  );
}

/** The reader's time zone, remembered by the sidebar; UTC until it is. */
function timeZoneOf(value = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: decodeURIComponent(value),
    }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
