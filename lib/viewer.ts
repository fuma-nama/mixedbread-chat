import { cache } from "react";
import { getSession } from "./auth";
import { getChat, getMessages } from "./db/queries";
import { listConnections } from "./mixedbread/organizations";
import type { Organization } from "./sources";

/** The signed-in person; without a connected organization there is nothing to search. */
export const getViewer = cache(async () => {
  const session = await getSession();
  if (!session) return undefined;
  const connections = await listConnections(session.user.id);
  if (connections.length === 0) return undefined;
  const organizations: Organization[] = connections.map(
    ({ organizationId, name }) => ({ id: organizationId, name }),
  );
  return { user: session.user, connections, organizations };
});

export type ChatData = NonNullable<Awaited<ReturnType<typeof readChat>>>;

/** A chat and its messages, when the reader may see it: they own it, or it is shared. */
export const readChat = cache(async (id: string) => {
  const [chat, session, messages] = await Promise.all([
    getChat(id),
    getSession(),
    getMessages(id),
  ]);
  if (!chat) return undefined;
  const owner = chat.userId === session?.user.id;
  if (!owner && chat.visibility !== "public") return undefined;
  const { title, visibility, leafId } = chat;
  return { title, visibility, leafId, owner, messages };
});
