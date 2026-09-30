import { cache } from "react";
import { getSession } from "./auth";
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
