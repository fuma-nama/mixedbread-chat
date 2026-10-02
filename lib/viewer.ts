import { cache } from "react";
import { chatRuns } from "./answers";
import { getSession } from "./auth";
import { getChat, getMessages } from "./db/queries";
import { listConnections } from "./mixedbread/organizations";
import type { Organization } from "./sources";

/** The signed-in person, when they have an organization to search. */
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

/** Only for its owner, or anyone once it is shared. */
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
  // Running or about to; only the owner's tabs follow it.
  const running = owner && (await chatRuns(id));
  return { title, visibility, leafId, owner, running, messages };
});
