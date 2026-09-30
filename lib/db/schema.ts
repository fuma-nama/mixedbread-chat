import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ChatMessage } from "../search-tool";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    visibility: text("visibility", { enum: ["private", "public"] })
      .default("private")
      .notNull(),
    /** The last message of the branch the user saw last. */
    leafId: text("leaf_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_userId_updatedAt_idx").on(table.userId, table.updatedAt),
  ],
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    /** The message before this one on its branch; edits and retries share it. */
    parentId: text("parent_id"),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    parts: jsonb("parts").$type<ChatMessage["parts"]>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_chatId_createdAt_idx").on(table.chatId, table.createdAt),
  ],
);

/** OAuth clients the build registered with Mixedbread. */
export const oauthClient = pgTable("oauth_client", {
  /** The callback URLs the client allows, space separated. */
  redirectUris: text("redirect_uris").primaryKey(),
  clientId: text("client_id").notNull(),
});
