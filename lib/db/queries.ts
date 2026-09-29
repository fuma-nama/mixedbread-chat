import { and, count, desc, eq, exists, gt, ilike, or, sql } from "drizzle-orm";
import { db } from ".";
import { chat, message } from "./schema";

export type Chat = typeof chat.$inferSelect;

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

/** A chat's messages, oldest first, with what the UI and the model need. */
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

/** Saves a message; resending one that is already saved does nothing. */
export async function saveMessage(values: typeof message.$inferInsert) {
  await db.insert(message).values(values).onConflictDoNothing();
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

export async function deleteChat(id: string, userId: string) {
  await db.delete(chat).where(and(eq(chat.id, id), eq(chat.userId, userId)));
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

/** Chats whose title or message text contains `query`. */
export function searchChats(userId: string, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const text = sql`jsonb_path_query_array(${message.parts}, '$[*] ? (@.type == "text").text')::text`;

  return db
    .select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
    .from(chat)
    .where(
      and(
        eq(chat.userId, userId),
        or(
          ilike(chat.title, pattern),
          exists(
            db
              .select({ id: message.id })
              .from(message)
              .where(and(eq(message.chatId, chat.id), ilike(text, pattern))),
          ),
        ),
      ),
    )
    .orderBy(desc(chat.updatedAt))
    .limit(20);
}
