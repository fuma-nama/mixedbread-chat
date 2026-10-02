import { cookies } from "next/headers";
import { DataProvider } from "@/components/data-provider";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SearchChats } from "@/components/sidebar/search-chats";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { getSession } from "@/lib/auth";
import { getChats } from "@/lib/db/queries";
import { defaultModel, listModels } from "@/lib/models";
import { isReasoning } from "@/lib/reasoning";
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
  const model = cookieStore.get("model")?.value;
  const reasoning = cookieStore.get("reasoning")?.value;

  return (
    <SidebarProvider
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      <DataProvider
        chats={viewer ? chats : []}
        organizations={viewer?.organizations ?? []}
        models={models}
        selection={parseSelection(cookieStore.get(SELECTION_COOKIE)?.value)}
        model={models.find((entry) => entry.id === model)?.id ?? defaultModel}
        reasoning={isReasoning(reasoning) ? reasoning : "auto"}
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
      </DataProvider>
    </SidebarProvider>
  );
}

function timeZoneOf(value = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: decodeURIComponent(value),
    }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
