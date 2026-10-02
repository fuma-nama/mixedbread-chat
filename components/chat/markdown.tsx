"use client";

import "katex/dist/katex.min.css";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { cn } from "cn";
import { DownloadIcon } from "lucide-react";
import { createContext, isValidElement, use, useRef } from "react";
import {
  CodeBlock,
  type Components,
  type ExtraProps,
  extractTableDataFromElement,
  Streamdown,
  StreamdownContext,
  type TableData,
  tableDataToCSV,
  tableDataToMarkdown,
  useIsCodeFenceIncomplete,
} from "streamdown";
import type { Citations } from "@/lib/messages";
import { Citation } from "./citation";
import { Action, CopyAction } from "./message-actions";

const NO_CITATIONS: Citations = new Map();
const CitationsContext = createContext(NO_CITATIONS);

const components: Components = { a: Link, code: Code, table: Table };
const plugins = { code, math };
// Code and tables bring their own actions; images stay plain pictures.
const controls = { image: false };
// Streamdown animates only while `isAnimating`.
const animated = {
  animation: "blurIn",
  duration: 360,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sep: "word",
  stagger: 14,
} as const;

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
  if (href?.startsWith("#S")) {
    const citation = use(CitationsContext).get(href.slice(1));
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

function Code({
  node: _,
  className,
  children,
  ...props
}: React.ComponentProps<"code"> & ExtraProps) {
  const { isAnimating, lineNumbers } = use(StreamdownContext);
  const incomplete = useIsCodeFenceIncomplete();

  // Streamdown marks the code inside a fence; anything else is inline.
  if (!("data-block" in props)) {
    return (
      <code
        data-streamdown="inline-code"
        className={cn(
          "rounded-[0.3rem] bg-muted px-[0.35em] py-[0.1em] font-mono text-[0.86em] text-foreground inset-ring inset-ring-soft",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  const { "data-block": _block, ...rest } = props;
  const language = className?.match(/language-(\S+)/)?.[1] ?? "";
  const inner = isValidElement<{ children?: unknown }>(children)
    ? children.props.children
    : children;
  const text = typeof inner === "string" ? inner : "";

  return (
    <CodeBlock
      code={text}
      language={language}
      isIncomplete={incomplete}
      lineNumbers={lineNumbers}
      // The body is what scrolls; its edge fades while long lines run past it.
      className={cn(className, "scroll-fade-x")}
      {...rest}
    >
      {!isAnimating && (
        <BlockActions
          what="code"
          copy={() => navigator.clipboard.writeText(text)}
          download={() =>
            save(text, `code.${extensionOf(language)}`, "text/plain")
          }
        />
      )}
    </CodeBlock>
  );
}

const extensions: Record<string, string> = {
  "c#": "cs",
  "c++": "cpp",
  bash: "sh",
  csharp: "cs",
  golang: "go",
  javascript: "js",
  kotlin: "kt",
  markdown: "md",
  plaintext: "txt",
  python: "py",
  ruby: "rb",
  rust: "rs",
  shell: "sh",
  text: "txt",
  typescript: "ts",
  yaml: "yml",
  zsh: "sh",
};

function extensionOf(language: string): string {
  const name = language.toLowerCase();
  if (Object.hasOwn(extensions, name)) return extensions[name];
  return /^[a-z0-9]{1,10}$/.test(name) ? name : "txt";
}

// Tells spreadsheet apps that a CSV file is UTF-8.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function Table({
  node: _,
  ...props
}: React.ComponentProps<"table"> & ExtraProps) {
  const ref = useRef<HTMLTableElement>(null);
  // A table still streaming in has nothing whole to copy yet.
  const { isAnimating } = use(StreamdownContext);

  return (
    <div data-slot="table" className="relative">
      <div className="scroll-fade-x scrollbar-thin overflow-x-auto rounded-[14px] border border-soft outline-offset-2 outline-ring focus-visible:outline-2">
        <table
          ref={ref}
          {...props}
          data-streamdown="table"
          className="w-full divide-y"
        />
      </div>
      {!isAnimating && (
        <BlockActions
          what="table"
          // Columns scrolling by slip under a short fade rather than into the buttons.
          className="absolute top-[5px] right-[5px] rounded-lg bg-panel before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-4 before:bg-linear-to-l before:from-panel"
          copy={async () => {
            if (!ref.current) return;
            const table = dataOf(ref.current);
            // Rich for spreadsheets and documents, Markdown for everything else.
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/plain": new Blob([tableDataToMarkdown(table)], {
                  type: "text/plain",
                }),
                "text/html": new Blob([htmlOf(table)], { type: "text/html" }),
              }),
            ]);
          }}
          download={() => {
            if (!ref.current) return;
            const csv = tableDataToCSV(dataOf(ref.current));
            save(BYTE_ORDER_MARK + csv, "table.csv", "text/csv");
          }}
        />
      )}
    </div>
  );
}

function dataOf(table: HTMLTableElement): TableData {
  const copy = table.cloneNode(true) as HTMLTableElement;
  for (const citation of copy.querySelectorAll("[data-citation]")) {
    citation.remove();
  }
  return extractTableDataFromElement(copy);
}

function htmlOf({ headers, rows }: TableData): string {
  let html = `<table><thead>${rowOf(headers, "th")}</thead><tbody>`;
  for (const cells of rows) html += rowOf(cells, "td");
  return `${html}</tbody></table>`;
}

function rowOf(cells: string[], tag: "th" | "td"): string {
  let html = "<tr>";
  for (const cell of cells) html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
  return `${html}</tr>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** `.markdown` shows these on hover. */
function BlockActions({
  what,
  copy,
  download,
  className,
}: {
  what: "code" | "table";
  copy: () => Promise<void>;
  download: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="block-actions"
      className={cn("flex items-center", className)}
    >
      <CopyAction label={`Copy ${what}`} copy={copy} />
      <Action label={`Download ${what}`} onClick={download}>
        <DownloadIcon />
      </Action>
    </div>
  );
}

function save(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers drop the download if the file goes away in the same tick.
  setTimeout(() => URL.revokeObjectURL(url));
}
