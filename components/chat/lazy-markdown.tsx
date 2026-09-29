"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Streamdown, its highlighter and KaTeX load with the first answer, not the page.
const Markdown = dynamic(() =>
  import("./markdown").then((mod) => mod.Markdown),
);

/** Loads the markdown renderer ahead of the text that needs it. */
export function preloadMarkdown() {
  void import("./markdown");
}

/**
 * Markdown, loaded on demand. Text on the page from the start is in its
 * first HTML; `deferred` text, which arrives later, may wait for the
 * renderer to load without holding up the update that brought it.
 */
export function LazyMarkdown({
  deferred,
  ...props
}: React.ComponentProps<typeof Markdown> & { deferred: boolean }) {
  const markdown = <Markdown {...props} />;
  return deferred ? <Suspense>{markdown}</Suspense> : markdown;
}
