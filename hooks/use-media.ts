import { useSyncExternalStore } from "react";

// False on the server and while hydrating.
function mediaQuery(query: string) {
  let list: MediaQueryList | undefined;
  const media = () => (list ??= window.matchMedia(query));
  const subscribe = (onChange: () => void) => {
    media().addEventListener("change", onChange);
    return () => media().removeEventListener("change", onChange);
  };
  const matches = () => media().matches;
  const server = () => false;

  return function useMediaQuery() {
    return useSyncExternalStore(subscribe, matches, server);
  };
}

export const useReducedMotion = mediaQuery("(prefers-reduced-motion: reduce)");

export const useCoarsePointer = mediaQuery("(pointer: coarse)");

export const useMobile = mediaQuery("(max-width: 767px)");
