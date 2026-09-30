import { useSyncExternalStore } from "react";
import { remember } from "@/lib/remember";
import { type Theme, themeColors } from "@/lib/theme";

const listeners = new Set<() => void>();

/** The device's own switches come through `prefers-color-scheme` instead. */
export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function current(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, current, () => "system");
}

/** Crossfades the page where the browser can; elsewhere colors change at once. */
export function setTheme(theme: Theme) {
  remember("theme", theme);

  if (
    document.startViewTransition &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(() => apply(theme));
    return;
  }
  // Without the crossfade, colors with a transition would each ease on
  // their own while the rest switch at once.
  const still = document.createElement("style");
  still.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(still);
  apply(theme);
  // Settles the new colors while transitions are off.
  void getComputedStyle(document.body).color;
  setTimeout(() => still.remove(), 1);
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The browser's bars have one color per device scheme; a picked theme sets both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    const scheme = meta.media.includes("dark") ? "dark" : "light";
    meta.content = themeColors[theme === "system" ? scheme : theme];
  }
  for (const listener of listeners) listener();
}
