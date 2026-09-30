"use client";

import { createContext, use, useEffect, useState } from "react";
import { mutate } from "swr";
import useSWRImmutable from "swr/immutable";
import { disconnectOrganization, listAllStores } from "@/app/(chat)/actions";
import { toast } from "@/components/ui/toast";
import { createStore, type Store, useStore } from "@/hooks/use-store";
import { useWindowEvent } from "@/hooks/use-window-event";
import { PROVIDER_ID } from "@/lib/mixedbread/platform";
import { remember } from "@/lib/remember";
import {
  choiceFor,
  type Organization,
  type SearchScope,
  SELECTION_COOKIE,
  type SourceSelection,
  type StoreOption,
  type StoresResult,
  scopeOf,
  serializeSelection,
} from "@/lib/sources";

export type StoresState = { status: "loading" } | StoresResult;

interface Sources {
  organizations: Store<Organization[]>;
  selection: Store<SourceSelection>;
  /** Also remembered for the next visit. */
  select: (selection: SourceSelection) => void;
  disconnect: (organizationId: string) => Promise<void>;
}

const SourcesContext = createContext<Sources | null>(null);

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
  const [sources] = useState(() =>
    createSources(organizations, initialSelection),
  );

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

  return <SourcesContext value={sources}>{children}</SourcesContext>;
}

function createSources(
  initialOrganizations: Organization[],
  initialSelection: SourceSelection,
): Sources {
  const organizations = createStore(initialOrganizations);
  const selection = createStore(initialSelection);

  const sources: Sources = {
    organizations,
    selection,
    select(next) {
      selection.set(next);
      remember(SELECTION_COOKIE, serializeSelection(next));
    },
    async disconnect(organizationId) {
      await disconnectOrganization(organizationId);
      organizations.set(
        organizations.get().filter((entry) => entry.id !== organizationId),
      );
      const { [organizationId]: _, ...rest } = selection.get().organizations;
      sources.select({ ...selection.get(), organizations: rest });
    },
  };
  return sources;
}

/** The actions and stores; reading them never re-renders. */
export function useSources(): Sources {
  const sources = use(SourcesContext);
  if (!sources) throw new Error("useSources needs a <SourcesProvider>");
  return sources;
}

export function useOrganizations(): Organization[] {
  return useStore(useSources().organizations, (list) => list);
}

export function useSelection(): SourceSelection {
  return useStore(useSources().selection, (selection) => selection);
}

export function useSearchScope(): SearchScope {
  return scopeOf(useSelection(), useOrganizations());
}

/** Every organization's stores, loaded on first use; see `storesOf`. */
export function useAllStores(): Record<string, StoresState> | undefined {
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
export function useConnect(): { pending: boolean; connect: () => void } {
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
export function usePickedStores(): StoreOption[] {
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
