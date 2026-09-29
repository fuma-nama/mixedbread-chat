"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import * as queries from "@/lib/db/queries";
import { highlight } from "@/lib/highlight";
import { fetchPage, type Page } from "@/lib/mixedbread/files";
import {
  type Connection,
  clientFor,
  disconnect,
  fetchStores,
  listConnections,
  needsReconnect,
} from "@/lib/mixedbread/organizations";
import type { StoresResult } from "@/lib/sources";

async function currentUserId() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.user.id;
}

async function listStores(
  userId: string,
  connection: Connection,
): Promise<StoresResult> {
  try {
    return {
      status: "ok",
      stores: await fetchStores(await clientFor(userId, connection)),
    };
  } catch (error) {
    if (needsReconnect(error)) return { status: "reconnect" };
    return { status: "error", message: "Couldn’t load the stores." };
  }
}

export async function listOrganizationStores(
  organizationId: string,
): Promise<StoresResult> {
  const userId = await currentUserId();
  const connection = (await listConnections(userId)).find(
    (entry) => entry.organizationId === organizationId,
  );
  return connection ? listStores(userId, connection) : { status: "reconnect" };
}

/** One action for every organization, since a client runs server actions one at a time. */
export async function listAllStores(): Promise<Record<string, StoresResult>> {
  const userId = await currentUserId();
  const connections = await listConnections(userId);
  const results = await Promise.all(
    connections.map((connection) => listStores(userId, connection)),
  );
  const byOrganization: Record<string, StoresResult> = {};
  for (let i = 0; i < connections.length; i++) {
    byOrganization[connections[i].organizationId] = results[i];
  }
  return byOrganization;
}

export type PageResult =
  | { status: "ok"; page: Page; marked: number[] }
  | { status: "reconnect" }
  /** The chunk isn't a page, or the viewer can't reach its organization. */
  | { status: "missing" }
  | { status: "error" };

const citedPageSchema = z.object({
  organizationId: z.string(),
  storeId: z.string(),
  chunkId: z.string(),
  claim: z.string().max(2000).optional(),
});

/** A cited page, with the viewer's own access, and the blocks its claim stands for. */
export async function openPage(
  cited: z.input<typeof citedPageSchema>,
): Promise<PageResult> {
  const userId = await currentUserId();
  const { organizationId, storeId, chunkId, claim } =
    citedPageSchema.parse(cited);
  const connection = (await listConnections(userId)).find(
    (entry) => entry.organizationId === organizationId,
  );
  if (!connection) return { status: "missing" };
  try {
    const client = await clientFor(userId, connection);
    const page = await fetchPage(client, storeId, chunkId);
    if (!page) return { status: "missing" };
    const marked = claim ? highlight(claim, page.blocks) : [];
    return { status: "ok", page, marked };
  } catch (error) {
    return { status: needsReconnect(error) ? "reconnect" : "error" };
  }
}

export async function disconnectOrganization(organizationId: string) {
  await disconnect(await currentUserId(), organizationId);
}

export async function listChats() {
  return queries.getChats(await currentUserId());
}

export async function searchChats(query: string) {
  const userId = await currentUserId();
  return queries.searchChats(userId, z.string().max(200).parse(query));
}

export async function renameChat(id: string, title: string) {
  await queries.updateChat(id, await currentUserId(), {
    title: z.string().trim().min(1).max(200).parse(title),
  });
}

export async function deleteChats(ids: string[]) {
  const userId = await currentUserId();
  const parsed = z.array(z.string().max(100)).min(1).max(1000).parse(ids);
  await queries.deleteChats(parsed, userId);
}

/** Remembers the branch the user switched to. */
export async function setChatLeaf(id: string, leafId: string) {
  await queries.updateChat(id, await currentUserId(), {
    leafId: z.string().max(100).parse(leafId),
  });
}

export async function setChatVisibility(
  id: string,
  visibility: "private" | "public",
) {
  await queries.updateChat(id, await currentUserId(), {
    visibility: z.enum(["private", "public"]).parse(visibility),
  });
}
