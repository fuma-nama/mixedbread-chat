"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import * as queries from "@/lib/db/queries";
import { highlight } from "@/lib/highlight";
import { fetchPage, type Page } from "@/lib/mixedbread/files";
import {
  clientFor,
  disconnect,
  listConnections,
  listStores,
  needsReconnect,
} from "@/lib/mixedbread/organizations";
import type { StoresResult } from "@/lib/sources";

async function currentUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.user;
}

export async function listOrganizationStores(
  organizationId: string,
): Promise<StoresResult> {
  const user = await currentUser();
  for (const connection of await listConnections(user.id)) {
    if (connection.organizationId === organizationId) {
      return listStores(user.id, connection);
    }
  }
  return { status: "reconnect" };
}

/** One action for every organization, since a client runs server actions one at a time. */
export async function listAllStores(): Promise<Record<string, StoresResult>> {
  const user = await currentUser();
  const connections = await listConnections(user.id);
  const results = await Promise.all(
    connections.map((connection) => listStores(user.id, connection)),
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
  const user = await currentUser();
  const { organizationId, storeId, chunkId, claim } =
    citedPageSchema.parse(cited);
  for (const connection of await listConnections(user.id)) {
    if (connection.organizationId !== organizationId) continue;
    try {
      const client = await clientFor(user.id, connection);
      const page = await fetchPage(client, storeId, chunkId);
      if (!page) return { status: "missing" };
      const marked = claim ? highlight(claim, page.blocks) : [];
      return { status: "ok", page, marked };
    } catch (error) {
      return { status: needsReconnect(error) ? "reconnect" : "error" };
    }
  }
  return { status: "missing" };
}

export async function disconnectOrganization(organizationId: string) {
  await disconnect((await currentUser()).id, organizationId);
}

export async function listChats() {
  const user = await currentUser();
  return queries.getChats(user.id);
}

export async function searchChats(query: string) {
  const user = await currentUser();
  return queries.searchChats(user.id, z.string().max(200).parse(query));
}

export async function renameChat(id: string, title: string) {
  const user = await currentUser();
  const parsed = z.string().trim().min(1).max(200).parse(title);
  await queries.updateChat(id, user.id, { title: parsed });
}

export async function deleteChat(id: string) {
  const user = await currentUser();
  await queries.deleteChat(id, user.id);
}

/** Remembers the branch the user switched to. */
export async function setChatLeaf(id: string, leafId: string) {
  const user = await currentUser();
  await queries.updateChat(id, user.id, { leafId });
}

export async function setChatVisibility(
  id: string,
  visibility: "private" | "public",
) {
  const user = await currentUser();
  await queries.updateChat(id, user.id, {
    visibility: z.enum(["private", "public"]).parse(visibility),
  });
}
