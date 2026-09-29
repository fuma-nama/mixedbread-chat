import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { chat } from "./db/schema";

export const auth = betterAuth({
  // Set BETTER_AUTH_URL for a custom domain; Vercel URLs and localhost work as is.
  baseURL: process.env.BETTER_AUTH_URL || {
    allowedHosts: ["localhost:*", "*.vercel.app"],
  },
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    anonymous({
      // A guest keeps their chats when they sign up or log in.
      async onLinkAccount({ anonymousUser, newUser }) {
        await db
          .update(chat)
          .set({ userId: newUser.user.id })
          .where(eq(chat.userId, anonymousUser.user.id));
      },
    }),
    nextCookies(),
  ],
});

/** The visitor's session, looked up once per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
