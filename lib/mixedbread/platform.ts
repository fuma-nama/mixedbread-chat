export const PROVIDER_ID = "mixedbread";

export const PLATFORM_URL =
  process.env.MXBAI_PLATFORM_URL ?? "https://www.platform.mixedbread.com";

// The API scopes cover reading and searching stores, and running Toast.
export const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "stores:read",
  "completions:create",
];

export function callbackURL(origin: string): string {
  return new URL(`/api/auth/callback/${PROVIDER_ID}`, origin).href;
}

// A token reaches only the organization picked at sign-in, so each is its own account.
export function accountKey(subject: string, organizationId: string): string {
  return `${subject}:${organizationId}`;
}

export function organizationOfToken(token: string): string {
  const payload = token.split(".")[1];
  const claims = payload
    ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    : undefined;
  if (typeof claims?.organization_id !== "string") {
    throw new Error("The access token names no organization.");
  }
  return claims.organization_id;
}

/**
 * The name of the organization a token reaches, which only userinfo carries:
 * Better Auth reads the sign-in profile from the ID token. Sign-in goes on without it.
 */
export async function organizationName(
  token: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(`${PLATFORM_URL}/api/auth/oauth2/userinfo`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const { organization_name: name } = await response.json();
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}
