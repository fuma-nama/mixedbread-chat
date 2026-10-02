"use client";

import { atom, getDefaultStore, useAtomValue } from "jotai";
import { useState } from "react";
import { mutate } from "swr";
import useSWRImmutable from "swr/immutable";
import { disconnectOrganization, listAllStores } from "@/app/(chat)/actions";
import { toast } from "@/components/ui/toast";
import { useWindowEvent } from "@/hooks/use-window-event";
import { PROVIDER_ID } from "@/lib/mixedbread/platform";
import type { Model } from "@/lib/models";
import type { Reasoning } from "@/lib/reasoning";
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

export const modelsAtom = atom<Model[]>([]);
export const organizationsAtom = atom<Organization[]>([]);

export const modelAtom = atom("");
export const reasoningAtom = atom<Reasoning>("auto");

export const selectionAtom = atom<SourceSelection>({
  web: true,
  organizations: {},
});

const LOADING: StoresState = { status: "loading" };
const FAILED: StoresState = { status: "error" };

const STORES = "stores";
const loadStores = (): Promise<Record<string, StoresState>> =>
  listAllStores().catch(() => ({}));

export function select(next: SourceSelection) {
  getDefaultStore().set(selectionAtom, next);
  remember(SELECTION_COOKIE, serializeSelection(next));
}

export async function disconnect(organizationId: string) {
  await disconnectOrganization(organizationId);
  const store = getDefaultStore();
  const organizations = store.get(organizationsAtom);
  store.set(
    organizationsAtom,
    organizations.filter((entry) => entry.id !== organizationId),
  );
  const selection = store.get(selectionAtom);
  const { [organizationId]: _, ...rest } = selection.organizations;
  select({ ...selection, organizations: rest });
}

export function useModels() {
  return useAtomValue(modelsAtom);
}

export function useModel() {
  const model = useAtomValue(modelAtom);
  const reasoning = useAtomValue(reasoningAtom);
  const current = useModels().find((entry) => entry.id === model);
  // A model that doesn't take the effort picked for another thinks on Auto.
  const effort: Reasoning =
    reasoning !== "auto" && current?.efforts.includes(reasoning)
      ? reasoning
      : "auto";
  return { model, current, effort };
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

export function useAllStores() {
  return useSWRImmutable(STORES, loadStores).data;
}

export function storesOf(
  all: Record<string, StoresState> | undefined,
  organizationId: string,
): StoresState {
  return all ? (all[organizationId] ?? FAILED) : LOADING;
}

export function reloadStores(organizationId: string) {
  void mutate(STORES, loadStores(), {
    optimisticData: (all?: Record<string, StoresState>) => ({
      ...all,
      [organizationId]: LOADING,
    }),
    revalidate: false,
  });
}

async function linkOrganization() {
  // Nothing else on chat pages needs the auth client.
  const { authClient } = await import("@/lib/auth-client");
  const result = await authClient.linkSocial({
    provider: PROVIDER_ID,
    callbackURL: window.location.pathname,
    errorCallbackURL: window.location.pathname,
  });
  if (result.error) throw new Error(result.error.message);
}

/** Its pending state resets on a return through the back button. */
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

/** Stores ticked one by one; Auto and whole organizations add none. */
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
    for (const store of state.stores) if (ids.has(store.id)) picked.push(store);
  }
  return picked;
}
