import { cookies } from "next/headers";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ChatsProvider } from "@/components/sidebar/chats-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
      <ChatsProvider initialChats={chats}>
        <AppSidebar
          user={
            session && !session.user.isAnonymous
              ? { name: session.user.name, email: session.user.email }
              : undefined
          }
        />
        <SidebarInset className="h-dvh">{children}</SidebarInset>
      </ChatsProvider>
    </SidebarProvider>
  );
}
