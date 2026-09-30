import { useSyncExternalStore } from "react";

export interface Store<T> {
  /** The value it was created with, which the server rendered. */
  initial: T;
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(value: T): Store<T> {
  const listeners = new Set<() => void>();

  return {
    initial: value,
    get: () => value,
    set(next) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Re-renders only when the part `select` picks changes. A part of the page
 * that hydrates late starts from what the server saw.
 */
export function useStore<T, S>(store: Store<T>, select: (value: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.initial),
  );
}
