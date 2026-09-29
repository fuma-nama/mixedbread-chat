import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "./use-media";

/**
 * Glides an element's width or height to its new size when a render changes
 * it, rather than letting it jump. Changed again mid-glide, it goes on from
 * where it is.
 */
export function useGlide<T extends HTMLElement>(
  axis: "width" | "height",
  duration: number,
) {
  const ref = useRef<T>(null);
  const last = useRef<{ size: number; glide?: Animation }>(undefined);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Layout sizes, so a popup scaling in doesn't count as a change.
    const size = () =>
      axis === "width" ? element.offsetWidth : element.offsetHeight;
    const glide = last.current?.glide;
    const from = glide?.playState === "running" ? size() : last.current?.size;
    glide?.cancel();
    const to = size();
    last.current = { size: to };
    if (reduced || from === undefined || from === to) return;
    last.current.glide = element.animate(
      { [axis]: [`${from}px`, `${to}px`] },
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  });

  return ref;
}
