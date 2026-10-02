import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import {
  accountKey,
  organizationOfToken,
  PLATFORM_URL,
  PROVIDER_ID,
  SCOPES,
} from "./mixedbread/platform";

/** Set by hand, or registered by the build: see `scripts/register-client.ts`. */
export const clientId = process.env.MXBAI_CLIENT_ID;

export const auth = betterAuth({
  // Set BETTER_AUTH_URL on a custom domain.
  baseURL: process.env.BETTER_AUTH_URL || {
    allowedHosts: ["localhost:*", "*.vercel.app"],
  },
  database: drizzleAdapter(db, { provider: "pg" }),
  advanced: { database: { joins: true } },
  // Home shows errors with no page of their own: as a toast, or on the sign-in page.
  onAPIError: { errorURL: "/" },
  account: {
    encryptOAuthTokens: true,
    // Signing in to another organization adds it to the same person.
    accountLinking: { trustedProviders: [PROVIDER_ID] },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: PROVIDER_ID,
          name: "Mixedbread",
          discoveryUrl: `${PLATFORM_URL}/.well-known/openid-configuration`,
          clientId: clientId ?? "",
          pkce: true,
          scopes: SCOPES,
          accountSubject: ({ tokens, profile }) =>
            accountKey(
              String(profile.sub),
              organizationOfToken(tokens.accessToken ?? ""),
            ),
          overrideUserInfo: true,
        },
      ],
    }),
    nextCookies(),
  ],
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
