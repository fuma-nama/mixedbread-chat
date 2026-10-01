import { and, count, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
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

/**
 * Saves a message after `parentId`, or after the chat's latest, and makes it
 * the latest. The chat stays locked meanwhile, so messages sent at once keep
 * their order. Resending a saved message moves to it. Returns its parent.
 */
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

/** Keeps what an answer wrote. */
export async function saveParts(
  id: string,
  parts: (typeof message.$inferInsert)["parts"],
) {
  await db.update(message).set({ parts }).where(eq(message.id, id));
}

/** Updates a chat only when `userId` owns it. */
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

/** How many answers the user got since `since`, retries included. */
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

export function searchChats(userId: string, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const text = sql`jsonb_path_query_array(${message.parts}, '$[*] ? (@.type == "text").text')::text`;
  const mine = eq(chat.userId, userId);

  return db
    .select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
    .from(chat)
    .where(
      and(
        mine,
        or(
          ilike(chat.title, pattern),
          // Joined to the user's chats, so no plan reads others' messages.
          inArray(
            chat.id,
            db
              .select({ id: message.chatId })
              .from(message)
              .innerJoin(chat, eq(message.chatId, chat.id))
              .where(and(mine, ilike(text, pattern))),
          ),
        ),
      ),
    )
    .orderBy(desc(chat.updatedAt))
    .limit(20);
}
