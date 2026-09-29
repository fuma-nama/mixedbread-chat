/**
 * Registers the app with Mixedbread as a public OAuth client and prints the
 * `MXBAI_CLIENT_ID` to set. Pass every URL the app is opened at:
 *
 *   pnpm mixedbread:register https://chat.example.com http://localhost:3000
 */
import {
  callbackURL,
  PLATFORM_URL,
  SCOPES,
} from "../lib/mixedbread/platform.ts";

const origins = process.argv.slice(2);
if (origins.length === 0) {
  console.error("Usage: pnpm mixedbread:register <app URL> [more app URLs]");
  process.exit(1);
}

const discovery: { registration_endpoint?: string } = await fetch(
  `${PLATFORM_URL}/.well-known/openid-configuration`,
).then((response) => response.json());
if (!discovery.registration_endpoint) {
  console.error(`${PLATFORM_URL} does not accept client registrations.`);
  process.exit(1);
}

// Mixedbread's consent screen shows these, so only a public address.
const site = origins.find((origin) => origin.startsWith("https://"));
const redirects: string[] = [];
for (const origin of origins) redirects.push(callbackURL(origin));

const response = await fetch(discovery.registration_endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_name: process.env.MXBAI_CLIENT_NAME ?? "Bread Chat",
    ...(site && {
      client_uri: site,
      logo_uri: new URL("/icon.svg", site).href,
    }),
    redirect_uris: redirects,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: SCOPES.join(" "),
  }),
});
if (!response.ok) {
  console.error(
    `Registration failed (${response.status}): ${await response.text()}`,
  );
  process.exit(1);
}

const client: { client_id: string } = await response.json();
console.log(`MXBAI_CLIENT_ID=${client.client_id}`);
