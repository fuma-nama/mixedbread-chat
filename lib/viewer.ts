import { cache } from "react";
import { getSession } from "./auth";
import { type Connection, listConnections } from "./mixedbread/organizations";
import type { Organization } from "./sources";

export interface Viewer {
  user: { id: string; name: string; email: string; image?: string | null };
  connections: Connection[];
  organizations: Organization[];
}

/** The signed-in person; without a connected organization there is nothing to search. */
export const getViewer = cache(async (): Promise<Viewer | undefined> => {
  const session = await getSession();
  if (!session) return undefined;
  const connections = await listConnections(session.user.id);
  if (connections.length === 0) return undefined;
  const organizations: Organization[] = [];
  for (const { organizationId, name } of connections) {
    organizations.push({ id: organizationId, name });
  }
  return { user: session.user, connections, organizations };
});
