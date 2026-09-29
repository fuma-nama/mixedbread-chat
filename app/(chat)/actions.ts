"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import * as queries from "@/lib/db/queries";
import {
  disconnect,
  listConnections,
  listStores,
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
