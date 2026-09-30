import { useSyncExternalStore } from "react";

export type Store<T> = ReturnType<typeof createStore<T>>;

export function createStore<T>(value: T) {
  const listeners = new Set<() => void>();

  return {
    /** The value it was created with, which the server rendered. */
    initial: value,
    get: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
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
