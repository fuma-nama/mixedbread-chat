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

/**
 * The organization a token reaches, from userinfo: Better Auth builds the
 * sign-in profile from the ID token, which names none.
 */
export async function organizationOf(
  token: string,
): Promise<{ id: string; name?: string }> {
  const response = await fetch(`${PLATFORM_URL}/api/auth/oauth2/userinfo`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { organization_id: id, organization_name: name } =
    await response.json();
  if (typeof id !== "string") {
    throw new Error("Mixedbread named no organization.");
  }
  return { id, name };
}
