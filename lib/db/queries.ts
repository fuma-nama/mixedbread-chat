import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from ".";
import { chat, message } from "./schema";

type Chat = typeof chat.$inferSelect;

export function getChats(userId: string) {
  return db
    .select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.updatedAt))
    .limit(100);
}

export async function getChat(id: string): Promise<Chat | undefined> {
  const [row] = await db.select().from(chat).where(eq(chat.id, id));
  return row;
}

export async function getLeafRole(chatId: string) {
  const [row] = await db
    .select({ role: message.role })
    .from(chat)
    .innerJoin(message, eq(message.id, chat.leafId))
    .where(eq(chat.id, chatId));
  return row?.role;
}

export function getMessages(chatId: string) {
  return db
    .select({
      id: message.id,
      parentId: message.parentId,
      role: message.role,
      parts: message.parts,
    })
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(message.createdAt);
}

export async function createChat(values: typeof chat.$inferInsert) {
  await db.insert(chat).values(values);
}

/** Keeps messages sent at once in order; resending one moves to it. Returns its parent. */
export function appendMessage(
  chatId: string,
  values: Pick<typeof message.$inferInsert, "id" | "role" | "parts">,
  parentId?: string | null,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ leafId: chat.leafId })
      .from(chat)
      .where(eq(chat.id, chatId))
      .for("update");
    const parent = parentId === undefined ? (row?.leafId ?? null) : parentId;
    await tx
      .insert(message)
      .values({ ...values, chatId, parentId: parent })
      .onConflictDoNothing();
    await tx
      .update(chat)
      .set({ leafId: values.id, updatedAt: new Date() })
      .where(eq(chat.id, chatId));
    return parent;
  });
}

export async function saveParts(
  id: string,
  parts: (typeof message.$inferInsert)["parts"],
) {
  await db.update(message).set({ parts }).where(eq(message.id, id));
}

export async function updateChat(
  id: string,
  userId: string,
  values: Partial<Pick<Chat, "title" | "visibility" | "leafId" | "updatedAt">>,
) {
  await db
    .update(chat)
    .set(values)
    .where(and(eq(chat.id, id), eq(chat.userId, userId)));
}

export async function deleteChats(ids: string[], userId: string) {
  await db
    .delete(chat)
    .where(and(inArray(chat.id, ids), eq(chat.userId, userId)));
}

export async function countAnswers(userId: string, since: Date) {
  const [row] = await db
    .select({ count: count() })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(
      and(
        eq(chat.userId, userId),
        eq(message.role, "assistant"),
        gt(message.createdAt, since),
      ),
    );
  return row.count;
}
