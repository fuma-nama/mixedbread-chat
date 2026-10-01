"use client";

import { createStore, Provider } from "jotai";

/**
 * The tab's atoms, which navigation also sets outside React. Each server
 * render gets its own, so a request never sees another's.
 */
export const store = typeof window === "undefined" ? undefined : createStore();

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
