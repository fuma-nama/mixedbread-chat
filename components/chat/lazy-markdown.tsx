"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Streamdown, its highlighter and KaTeX load with the first answer, not the page.
const Markdown = dynamic(() =>
  import("./markdown").then((mod) => mod.Markdown),
);

export function preloadMarkdown() {
  void import("./markdown");
}

// Text there from the start is in the first HTML; `deferred` text, arriving
// later, may wait for the renderer without holding up the update that brought it.
export function LazyMarkdown({
  deferred,
  ...props
}: React.ComponentProps<typeof Markdown> & { deferred: boolean }) {
  const markdown = <Markdown {...props} />;
  return deferred ? <Suspense>{markdown}</Suspense> : markdown;
}
