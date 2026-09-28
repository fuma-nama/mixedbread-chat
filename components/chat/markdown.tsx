"use client";

import { code } from "@streamdown/code";
import { createContext, useContext } from "react";
import { type Components, type ExtraProps, Streamdown } from "streamdown";
import type { Source } from "@/lib/mixedbread/citations";
import { Citation } from "./citation";

/** The sources a message cites, by label, numbered in order of first citation. */
export type Citations = Map<string, { number: number; source: Source }>;

const CitationsContext = createContext<Citations>(new Map());

const components: Components = { a: Link };
const plugins = { code };

/** Streaming markdown that renders `[S1](#S1)` links as citations. */
export function Markdown({
  citations,
  ...props
}: React.ComponentProps<typeof Streamdown> & { citations: Citations }) {
  return (
    <CitationsContext value={citations}>
      <Streamdown components={components} plugins={plugins} {...props} />
    </CitationsContext>
  );
}

function Link({ href, children }: React.ComponentProps<"a"> & ExtraProps) {
  const citations = useContext(CitationsContext);

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
      className="font-medium underline underline-offset-4"
    >
      {children}
    </a>
  );
}
