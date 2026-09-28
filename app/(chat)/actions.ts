"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import * as queries from "@/lib/db/queries";

async function currentUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.user;
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
