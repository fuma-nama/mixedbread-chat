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

/** The organization a sign-in granted, as Mixedbread's userinfo names it. */
export function organizationOf(profile: Record<string, unknown>): {
  id: string;
  name?: string;
} {
  const { organization_id: id, organization_name: name } = profile;
  if (typeof id !== "string") {
    throw new Error("Mixedbread named no organization.");
  }
  return { id, name: typeof name === "string" ? name : undefined };
}
