import { useSyncExternalStore } from "react";

/** A value that components subscribe to, outside React state. */
export interface Store<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(value: T): Store<T> {
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set(next) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The part of the store `select` picks: re-renders only when that changes. */
export function useStore<T, S>(store: Store<T>, select: (value: T) => S): S {
  const get = () => select(store.get());
  return useSyncExternalStore(store.subscribe, get, get);
}
