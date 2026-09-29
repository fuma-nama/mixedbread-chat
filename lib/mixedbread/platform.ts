export const PROVIDER_ID = "mixedbread";

export const PLATFORM_URL =
  process.env.MXBAI_PLATFORM_URL ?? "https://www.platform.mixedbread.com";

export const SCOPES = ["openid", "profile", "email", "offline_access"];

/** Where Better Auth receives Mixedbread's sign-in callback. */
export function callbackURL(origin: string): string {
  return new URL(`/api/auth/callback/${PROVIDER_ID}`, origin).href;
}

/**
 * A token reaches only the organization picked while signing in, so each
 * organization is its own account, keyed by user then organization.
 */
export function accountKey(subject: string, organizationId: string): string {
  return `${subject}:${organizationId}`;
}

export function organizationOfKey(key: string): string {
  return key.slice(key.lastIndexOf(":") + 1);
}

/** The organization an access token was granted for. */
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
