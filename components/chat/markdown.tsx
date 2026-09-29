"use client";

import "katex/dist/katex.min.css";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { cn } from "cn";
import { createContext, use } from "react";
import { type Components, type ExtraProps, Streamdown } from "streamdown";
import type { Citations } from "@/lib/messages";
import { Citation } from "./citation";
import { Code } from "./code";
import { Table } from "./table";

const NO_CITATIONS: Citations = new Map();
const CitationsContext = createContext(NO_CITATIONS);

const components: Components = { a: Link, code: Code, table: Table };
const plugins = { code, math };
// Code and tables bring their own actions; images stay plain pictures.
const controls = { image: false };
// Words blur in as they stream. Streamdown only animates while `isAnimating`.
const animated = {
  animation: "blurIn",
  duration: 360,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sep: "word",
  stagger: 14,
} as const;

/** Streaming markdown that renders `[S1](#S1)` links as citations. */
export function Markdown({
  citations = NO_CITATIONS,
  className,
  ...props
}: React.ComponentProps<typeof Streamdown> & { citations?: Citations }) {
  return (
    <CitationsContext value={citations}>
      <Streamdown
        className={cn(
          "markdown text-[15px]/[1.7] wrap-break-word text-foreground/90",
          className,
        )}
        components={components}
        plugins={plugins}
        controls={controls}
        // Long code shows in full rather than scrolling inside the chat's scroll.
        codeBlockMaxHeight={0}
        animated={animated}
        {...props}
      />
    </CitationsContext>
  );
}

function Link({ href, children }: React.ComponentProps<"a"> & ExtraProps) {
  const citations = use(CitationsContext);

  if (href?.startsWith("#S")) {
    const citation = citations.get(href.slice(1));
    return citation ? <Citation {...citation} /> : null;
  }
  if (!href || href === "streamdown:incomplete-link") return children;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-streamdown="link"
      className="font-[450] text-foreground underline decoration-foreground/25 underline-offset-3 outline-offset-2 outline-ring transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-foreground focus-visible:outline-2"
    >
      {children}
    </a>
  );
}
