"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useEffect, useState } from "react";
import { mutate } from "swr";
import useSWRImmutable from "swr/immutable";
import { disconnectOrganization, listAllStores } from "@/app/(chat)/actions";
import { toast } from "@/components/ui/toast";
import { useWindowEvent } from "@/hooks/use-window-event";
import { PROVIDER_ID } from "@/lib/mixedbread/platform";
import { remember } from "@/lib/remember";
import {
  choiceFor,
  type Organization,
  SELECTION_COOKIE,
  type SourceSelection,
  type StoreOption,
  type StoresResult,
  scopeOf,
  serializeSelection,
} from "@/lib/sources";

export type StoresState = { status: "loading" } | StoresResult;

const organizationsAtom = atom<Organization[]>([]);
const selectionAtom = atom<SourceSelection>({ web: true, organizations: {} });

const LOADING: StoresState = { status: "loading" };
const LOAD_FAILED: StoresResult = {
  status: "error",
  message: "Couldn’t load the stores.",
};

// Every organization's stores, in one action: a client runs them one at a time.
const STORES = "stores";
const loadStores = (): Promise<Record<string, StoresState>> =>
  listAllStores().catch(() => ({}));

export function SourcesProvider({
  organizations,
  initialSelection,
  children,
}: {
  organizations: Organization[];
  initialSelection: SourceSelection;
  children: React.ReactNode;
}) {
  useHydrateAtoms([
    [organizationsAtom, organizations],
    [selectionAtom, initialSelection],
  ] as const);

  useEffect(() => {
    // Back from a connection that didn't finish, with Better Auth's reason.
    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    if (!error) return;
    url.searchParams.delete("error");
    window.history.replaceState(null, "", url);
    // The toaster above subscribes in its own effect, which runs after this one.
    queueMicrotask(() =>
      toast.add({
        title:
          error === "access_denied"
            ? "Connecting was cancelled."
            : "Connecting didn’t finish. Try again.",
      }),
    );
  }, []);

  return children;
}

/** Also remembered for the next visit. */
const selectAtom = atom(null, (_get, set, next: SourceSelection) => {
  set(selectionAtom, next);
  remember(SELECTION_COOKIE, serializeSelection(next));
});

const disconnectAtom = atom(null, async (get, set, organizationId: string) => {
  await disconnectOrganization(organizationId);
  set(organizationsAtom, (organizations) =>
    organizations.filter((entry) => entry.id !== organizationId),
  );
  const selection = get(selectionAtom);
  const { [organizationId]: _, ...rest } = selection.organizations;
  set(selectAtom, { ...selection, organizations: rest });
});

/** The actions; using them never re-renders. */
export function useSources() {
  return {
    select: useSetAtom(selectAtom),
    disconnect: useSetAtom(disconnectAtom),
  };
}

export function useOrganizations() {
  return useAtomValue(organizationsAtom);
}

export function useSelection() {
  return useAtomValue(selectionAtom);
}

export function useSearchScope() {
  return scopeOf(useSelection(), useOrganizations());
}

/** Every organization's stores, loaded on first use; see `storesOf`. */
export function useAllStores() {
  return useSWRImmutable(STORES, loadStores).data;
}

export function storesOf(
  all: Record<string, StoresState> | undefined,
  organizationId: string,
): StoresState {
  return all ? (all[organizationId] ?? LOAD_FAILED) : LOADING;
}

/** Loads the stores again, with this organization's showing as loading. */
export function reloadStores(organizationId: string) {
  void mutate(STORES, loadStores(), {
    optimisticData: (all?: Record<string, StoresState>) => ({
      ...all,
      [organizationId]: LOADING,
    }),
    revalidate: false,
  });
}

/** Leaves for Mixedbread to grant an organization, then comes back here. */
async function linkOrganization() {
  // Loaded on demand: nothing else on chat pages needs the auth client.
  const { authClient } = await import("@/lib/auth-client");
  const result = await authClient.linkSocial({
    provider: PROVIDER_ID,
    callbackURL: window.location.pathname,
    errorCallbackURL: window.location.pathname,
  });
  if (result.error) throw new Error(result.error.message);
}

/** Connecting, with a pending state that a return through the back button resets. */
export function useConnect() {
  const [pending, setPending] = useState(false);

  useWindowEvent("pageshow", (event) => {
    if (event.persisted) setPending(false);
  });

  return {
    pending,
    connect() {
      setPending(true);
      linkOrganization().catch(() => {
        setPending(false);
        toast.add({ title: "Couldn’t reach Mixedbread. Try again." });
      });
    },
  };
}

/** The stores picked one by one; an organization on Auto or searched whole adds none. */
export function usePickedStores() {
  const organizations = useOrganizations();
  const selection = useSelection();
  const all = useAllStores();
  const picked: StoreOption[] = [];
  for (const organization of organizations) {
    const choice = choiceFor(selection, organization.id);
    const state = storesOf(all, organization.id);
    if (typeof choice === "string" || state.status !== "ok") continue;
    const ids = new Set(choice);
    for (const store of state.stores) {
      if (ids.has(store.id)) picked.push(store);
    }
  }
  return picked;
}
