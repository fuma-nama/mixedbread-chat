"use client";

import { getDefaultStore, Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { type ChatSummary, chatsAtom } from "@/components/chat/chat-cache";
import {
  modelAtom,
  modelsAtom,
  organizationsAtom,
  reasoningAtom,
  selectionAtom,
} from "@/components/chat/picks";
import type { Model } from "@/lib/models";
import type { Reasoning } from "@/lib/reasoning";
import type { Organization, SourceSelection } from "@/lib/sources";

// Each server render gets atoms of its own, so a request never sees another's.
// The tab's are jotai's default store, which code outside React also sets.
const store = typeof window === "undefined" ? undefined : getDefaultStore();

interface Data {
  chats: ChatSummary[];
  organizations: Organization[];
  models: Model[];
  selection: SourceSelection;
  model: string;
  reasoning: Reasoning;
  children: React.ReactNode;
}

/** The tab's state, starting from what the page rendered with. */
export function DataProvider(data: Data) {
  return (
    <Provider store={store}>
      <Hydrate {...data} />
    </Provider>
  );
}

function Hydrate(data: Data) {
  useHydrateAtoms([
    [chatsAtom, data.chats],
    [organizationsAtom, data.organizations],
    [modelsAtom, data.models],
    [selectionAtom, data.selection],
    [modelAtom, data.model],
    [reasoningAtom, data.reasoning],
  ] as const);
  return data.children;
}
