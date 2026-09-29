import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "./use-media";

/**
 * Glides an element's width or height to its new size when a render changes
 * it, rather than letting it jump. Changed again mid-glide, it goes on from
 * where it is. While it glides, `--glide-to` holds the new size, so content
 * can take it at once rather than being squeezed on the way.
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
    // Layout sizes, so a popup scaling in doesn't count as a change, and
    // unrounded, so the glide ends where layout does.
    const size = () => parseFloat(getComputedStyle(element)[axis]);
    const glide = last.current?.glide;
    const from = glide?.playState === "running" ? size() : last.current?.size;
    glide?.cancel();
    const to = size();
    last.current = { size: to };
    if (reduced || from === undefined || from === to) return;
    // Rounded up, as a size set back as a length can come out a hair short.
    const end = `${Math.ceil(to)}px`;
    last.current.glide = element.animate(
      {
        [axis]: [`${from}px`, `${to}px`],
        // Unshrunk, so in a crowded flex row it lands where layout will.
        flexShrink: [0, 0],
        "--glide-to": [end, end],
      },
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  });

  return ref;
}
