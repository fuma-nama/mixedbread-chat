import { Mixedbread } from "@mixedbread/sdk";
import { and, asc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../auth";
import { db } from "../db";
import { account } from "../db/schema";
import { MAX_STORES, type StoreOption } from "../sources";
import { organizationOfKey, PROVIDER_ID } from "./platform";

class ReconnectError extends Error {}

/** Whether signing in to the organization again would fix `error`. */
export function needsReconnect(error: unknown): boolean {
  return (
    error instanceof ReconnectError ||
    error instanceof Mixedbread.AuthenticationError ||
    error instanceof Mixedbread.PermissionDeniedError
  );
}

export async function listConnections(userId: string) {
  const rows = await db
    .select({
      id: account.id,
      key: account.accountId,
      expiresAt: account.accessTokenExpiresAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, PROVIDER_ID)))
    .orderBy(asc(account.createdAt));
  return rows.map((row, index) => ({
    accountId: row.id,
    organizationId: organizationOfKey(row.key),
    // The platform shares no organization names yet.
    name: `Organization ${index + 1}`,
    expiresAt: row.expiresAt,
  }));
}

/** A grant to one organization, stored as a Better Auth account. */
export type Connection = Awaited<ReturnType<typeof listConnections>>[number];

/** Forgets one grant. The last stays: it is how the user signs in. */
export async function disconnect(userId: string, organizationId: string) {
  const connections = await listConnections(userId);
  const connection = connections.find(
    (entry) => entry.organizationId === organizationId,
  );
  if (!connection || connections.length < 2) return;
  await db
    .delete(account)
    .where(
      and(eq(account.id, connection.accountId), eq(account.userId, userId)),
    );
}

// Refreshed this early, so a token never runs out in the middle of a search.
const REFRESH_MARGIN = 60_000;

function fresh(expiresAt: Date | null): boolean {
  return (expiresAt?.getTime() ?? 0) - Date.now() > REFRESH_MARGIN;
}

// Refresh tokens are single-use and reusing one revokes the grant, so
// refreshes take a lock per account.
export async function clientFor(
  userId: string,
  { accountId, expiresAt }: Connection,
): Promise<Mixedbread> {
  // Better Auth resolves its base URL, which varies by host, from the request.
  const call = { body: { accountId, userId }, headers: await headers() };
  // An expiry listed earlier can only be too early: refreshing moves it later.
  const token = fresh(expiresAt)
    ? (await auth.api.getAccessToken(call)).accessToken
    : await db
        .transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${accountId}))`,
          );
          // Another request may have refreshed it while this one waited.
          const [row] = await tx
            .select({ expiresAt: account.accessTokenExpiresAt })
            .from(account)
            .where(eq(account.id, accountId));
          if (!row) return undefined;
          if (fresh(row.expiresAt)) {
            return (await auth.api.getAccessToken(call)).accessToken;
          }
          return (await auth.api.refreshToken(call)).accessToken;
        })
        .catch(() => undefined);
  if (!token) throw new ReconnectError();
  return new Mixedbread({ apiKey: token });
}

export async function fetchStores(client: Mixedbread): Promise<StoreOption[]> {
  const { data } = await client.stores.list({ limit: MAX_STORES });
  const stores = data.map((store) => ({
    id: store.id,
    name: store.name,
    description: store.description ?? null,
    files: store.file_counts?.completed ?? 0,
    status: store.status ?? "completed",
    updatedAt: store.updated_at,
  }));
  return stores.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
