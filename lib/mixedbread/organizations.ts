import { Mixedbread } from "@mixedbread/sdk";
import { and, asc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../auth";
import { db } from "../db";
import { account } from "../db/schema";
import type { StoreOption, StoresResult } from "../sources";
import { organizationOfKey, PROVIDER_ID } from "./platform";

/** A grant to one organization, stored as a Better Auth account. */
export interface Connection {
  /** The Better Auth account row holding this organization's tokens. */
  accountId: string;
  organizationId: string;
  name: string;
}

class ReconnectError extends Error {}

/** Whether signing in to the organization again would fix `error`. */
export function needsReconnect(error: unknown): boolean {
  return (
    error instanceof ReconnectError ||
    error instanceof Mixedbread.AuthenticationError ||
    error instanceof Mixedbread.PermissionDeniedError
  );
}

/** The organizations `userId` connected, oldest first. */
export async function listConnections(userId: string): Promise<Connection[]> {
  const rows = await db
    .select({ id: account.id, key: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, PROVIDER_ID)))
    .orderBy(asc(account.createdAt));
  const connections: Connection[] = [];
  for (const row of rows) {
    connections.push({
      accountId: row.id,
      organizationId: organizationOfKey(row.key),
      // The platform shares no organization names yet.
      name: `Organization ${connections.length + 1}`,
    });
  }
  return connections;
}

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

/** Refresh this early, so a token never runs out in the middle of a search. */
const REFRESH_MARGIN = 60_000;

function fresh(expiresAt: Date | null): boolean {
  return (expiresAt?.getTime() ?? 0) - Date.now() > REFRESH_MARGIN;
}

async function expiryOf(
  accountId: string,
  from: Pick<typeof db, "select"> = db,
) {
  const [row] = await from
    .select({ expiresAt: account.accessTokenExpiresAt })
    .from(account)
    .where(eq(account.id, accountId));
  if (!row) throw new ReconnectError();
  return row.expiresAt;
}

/**
 * Refresh tokens are single-use and reusing one revokes the grant, so
 * refreshes take a lock per account.
 */
async function accessToken(userId: string, { accountId }: Connection) {
  // Better Auth resolves its base URL, which varies by host, from the request.
  const call = { body: { accountId, userId }, headers: await headers() };
  const token = fresh(await expiryOf(accountId))
    ? (await auth.api.getAccessToken(call)).accessToken
    : await db
        .transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${accountId}))`,
          );
          // Another request may have refreshed it while this one waited.
          if (fresh(await expiryOf(accountId, tx))) {
            return (await auth.api.getAccessToken(call)).accessToken;
          }
          return (await auth.api.refreshToken(call)).accessToken;
        })
        .catch(() => undefined);
  if (token) return token;
  throw new ReconnectError();
}

/** An API client acting as `userId` in `connection`'s organization. */
export async function clientFor(
  userId: string,
  connection: Connection,
): Promise<Mixedbread> {
  return new Mixedbread({ apiKey: await accessToken(userId, connection) });
}

/** The first page of an organization's stores, most recently changed first. */
export async function fetchStores(client: Mixedbread): Promise<StoreOption[]> {
  const page = await client.stores.list({ limit: 100 });
  const stores: StoreOption[] = [];
  for (const store of page.data) {
    stores.push({
      id: store.id,
      name: store.name,
      description: store.description ?? null,
      files: store.file_counts?.completed ?? 0,
      status: store.status ?? "completed",
      updatedAt: store.updated_at,
    });
  }
  return stores.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listStores(
  userId: string,
  connection: Connection,
): Promise<StoresResult> {
  try {
    return {
      status: "ok",
      stores: await fetchStores(await clientFor(userId, connection)),
    };
  } catch (error) {
    if (needsReconnect(error)) return { status: "reconnect" };
    return { status: "error", message: "Couldn’t load the stores." };
  }
}
