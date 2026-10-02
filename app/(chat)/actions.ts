"use server";

import { z } from "zod";
import { chatRuns } from "@/lib/answers";
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

export async function listChats() {
  return queries.getChats(await currentUserId());
}

/** Keyed by organization ID. */
export async function listAllStores(): Promise<Record<string, StoresResult>> {
  const userId = await currentUserId();
  const connections = await listConnections(userId);
  return Object.fromEntries(
    await Promise.all(
      connections.map(async (connection) => [
        connection.organizationId,
        await storesOf(userId, connection),
      ]),
    ),
  );
}

async function storesOf(
  userId: string,
  connection: Connection,
): Promise<StoresResult> {
  try {
    const client = await clientFor(userId, connection);
    return { status: "ok", stores: await fetchStores(client) };
  } catch (error) {
    return { status: needsReconnect(error) ? "reconnect" : "error" };
  }
}

export type PageResult =
  | { status: "ok"; page: Page; marked: number[] }
  | { status: "reconnect" }
  /** The chunk isn't a page, or the viewer can't reach its organization. */
  | { status: "missing" }
  | { status: "error" };

const citedSchema = z.object({
  organizationId: z.string(),
  storeId: z.string(),
  chunkId: z.string(),
  claim: z.string().max(2000).optional(),
});

/** A cited page, with the viewer's own access, and the blocks its claim stands for. */
export async function openPage(
  cited: z.input<typeof citedSchema>,
): Promise<PageResult> {
  const userId = await currentUserId();
  const { organizationId, storeId, chunkId, claim } = citedSchema.parse(cited);
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

export async function setChatLeaf(id: string, leafId: string) {
  const userId = await currentUserId();
  // Answers go after the leaf, so it holds still while one runs.
  if (await chatRuns(id)) return;
  await queries.updateChat(id, userId, {
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
