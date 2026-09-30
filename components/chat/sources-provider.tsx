"use client";

import { createContext, use, useEffect, useState } from "react";
import {
  disconnectOrganization,
  listAllStores,
  listOrganizationStores,
} from "@/app/(chat)/actions";
import { toast } from "@/components/ui/toast";
import { createStore, type Store, useStore } from "@/hooks/use-store";
import { useWindowEvent } from "@/hooks/use-window-event";
import { PROVIDER_ID } from "@/lib/mixedbread/platform";
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
  /** By organization ID; missing until first loaded. */
  stores: Store<Record<string, StoresState>>;
  /** Also remembered for the next visit. */
  select: (selection: SourceSelection) => void;
  load: (organizationId: string, force?: boolean) => void;
  /** Loads every organization not loaded yet, in one request. */
  prefetch: () => void;
  /** Leaves for Mixedbread to grant an organization, then comes back here. */
  connect: () => Promise<void>;
  disconnect: (organizationId: string) => Promise<void>;
}

const SourcesContext = createContext<Sources | null>(null);

const LOADING: StoresState = { status: "loading" };
const LOAD_FAILED: StoresResult = {
  status: "error",
  message: "Couldn’t load the stores.",
};

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
    sources.prefetch();
  }, [sources]);

  return <SourcesContext value={sources}>{children}</SourcesContext>;
}

function createSources(
  initialOrganizations: Organization[],
  initialSelection: SourceSelection,
): Sources {
  const organizations = createStore(initialOrganizations);
  const selection = createStore(initialSelection);
  const stores = createStore<Record<string, StoresState>>({});

  function patch(ids: string[], state: (id: string) => StoresState) {
    const next = { ...stores.get() };
    for (const id of ids) next[id] = state(id);
    stores.set(next);
  }

  const sources: Sources = {
    organizations,
    selection,
    stores,
    select(next) {
      selection.set(next);
      void cookieStore.set({
        name: SELECTION_COOKIE,
        value: serializeSelection(next),
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
    },
    load(organizationId, force = false) {
      const current = stores.get()[organizationId];
      if (current && (current.status === "loading" || !force)) return;
      const ids = [organizationId];
      patch(ids, () => LOADING);
      listOrganizationStores(organizationId).then(
        (result) => patch(ids, () => result),
        () => patch(ids, () => LOAD_FAILED),
      );
    },
    prefetch() {
      const ids: string[] = [];
      for (const { id } of organizations.get()) {
        if (!stores.get()[id]) ids.push(id);
      }
      if (ids.length === 0) return;
      patch(ids, () => LOADING);
      listAllStores().then(
        (results) => patch(ids, (id) => results[id] ?? LOAD_FAILED),
        () => patch(ids, () => LOAD_FAILED),
      );
    },
    async connect() {
      // Loaded on demand: nothing else on chat pages needs the auth client.
      const { authClient } = await import("@/lib/auth-client");
      const result = await authClient.linkSocial({
        provider: PROVIDER_ID,
        callbackURL: window.location.pathname,
      });
      if (result.error) throw new Error(result.error.message);
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

export function useStoresOf(organizationId: string): StoresState | undefined {
  return useStore(useSources().stores, (all) => all[organizationId]);
}

/** What the next question can search, for placeholders and suggestions. */
export function useSearchScope(): SearchScope {
  const organizations = useOrganizations();
  const selection = useSelection();
  return scopeOf(selection, organizations);
}

/** Every organization's stores, by organization ID; missing until first loaded. */
export function useAllStores(): Record<string, StoresState> {
  return useStore(useSources().stores, (all) => all);
}

/** `connect` with a pending state, which a return through the back button resets. */
export function useConnect(): { pending: boolean; connect: () => void } {
  const sources = useSources();
  const [pending, setPending] = useState(false);

  useWindowEvent("pageshow", (event) => {
    if (event.persisted) setPending(false);
  });

  return {
    pending,
    connect() {
      setPending(true);
      sources.connect().catch(() => {
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
    const state = all[organization.id];
    if (typeof choice === "string" || state?.status !== "ok") continue;
    const ids = new Set(choice);
    for (const store of state.stores) {
      if (ids.has(store.id)) picked.push(store);
    }
  }
  return picked;
}
