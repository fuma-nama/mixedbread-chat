/**
 * Registers the app with Mixedbread as a public OAuth client.
 *
 *   pnpm mixedbread:register https://chat.example.com http://localhost:3000
 *
 * prints an `MXBAI_CLIENT_ID` for every URL given. The build runs it without
 * URLs: unless `MXBAI_CLIENT_ID` is set, it registers the deployment's own
 * URLs once, keeps the client in the database for later builds, whose users'
 * tokens only refresh with the same client, and hands its ID to `next build`.
 */
import { appendFileSync } from "node:fs";
import postgres from "postgres";
import {
  callbackURL,
  PLATFORM_URL,
  SCOPES,
} from "../lib/mixedbread/platform.ts";

const urls = process.argv.slice(2);
if (urls.length > 0) {
  console.log(`MXBAI_CLIENT_ID=${await register(urls)}`);
} else if (!process.env.MXBAI_CLIENT_ID) {
  const origins = deploymentOrigins();
  if (origins.length === 0) {
    console.log("Usage: pnpm mixedbread:register <app URL> [more app URLs]");
  } else {
    const clientId = await persistedClient(origins);
    console.log(`MXBAI_CLIENT_ID=${clientId} for ${origins.join(", ")}`);
    // next.config.ts inlines it.
    appendFileSync(".env.production.local", `MXBAI_CLIENT_ID=${clientId}\n`);
  }
}

/** Where people open this deployment, from Vercel's system variables. */
function deploymentOrigins(): string[] {
  const env = process.env;
  if (env.BETTER_AUTH_URL) return [env.BETTER_AUTH_URL];
  const hosts =
    env.VERCEL_ENV === "production"
      ? [env.VERCEL_PROJECT_PRODUCTION_URL]
      : [env.VERCEL_BRANCH_URL, env.VERCEL_URL];
  const origins: string[] = [];
  for (const host of hosts) if (host) origins.push(`https://${host}`);
  return origins;
}

async function persistedClient(origins: string[]): Promise<string> {
  const redirects = redirectsOf(origins).join(" ");
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
  try {
    const [kept] =
      await sql`select client_id from oauth_client where redirect_uris = ${redirects}`;
    if (kept) return kept.client_id;
    const clientId = await register(origins);
    // A build running alongside may have kept its client first; that one wins.
    const [row] = await sql`insert into oauth_client (redirect_uris, client_id)
      values (${redirects}, ${clientId})
      on conflict (redirect_uris) do update set redirect_uris = excluded.redirect_uris
      returning client_id`;
    return row.client_id;
  } finally {
    await sql.end();
  }
}

function redirectsOf(origins: string[]): string[] {
  const redirects: string[] = [];
  for (const origin of origins) redirects.push(callbackURL(origin));
  return redirects;
}

async function register(origins: string[]): Promise<string> {
  const discovery: { registration_endpoint?: string } = await fetch(
    `${PLATFORM_URL}/.well-known/openid-configuration`,
  ).then((response) => response.json());
  if (!discovery.registration_endpoint) {
    fail(`${PLATFORM_URL} does not accept client registrations.`);
  }

  // Mixedbread's consent screen shows these, so only a public address.
  const site = origins.find((origin) => origin.startsWith("https://"));
  const response = await fetch(discovery.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: process.env.MXBAI_CLIENT_NAME ?? "Bread Chat",
      ...(site && {
        client_uri: site,
        logo_uri: new URL("/icon.svg", site).href,
      }),
      redirect_uris: redirectsOf(origins),
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPES.join(" "),
    }),
  });
  if (!response.ok) {
    fail(`Registration failed (${response.status}): ${await response.text()}`);
  }
  const client: { client_id: string } = await response.json();
  return client.client_id;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
