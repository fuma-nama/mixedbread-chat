import { useEffect, useEffectEvent } from "react";

/** Listens for `type` on the window, calling the latest `listener`. */
export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
) {
  const onEvent = useEffectEvent(listener);

  useEffect(() => {
    window.addEventListener(type, onEvent);
    return () => window.removeEventListener(type, onEvent);
  }, [type]);
}
