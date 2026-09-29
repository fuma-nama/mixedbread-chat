"use client";

import { useContext, useRef } from "react";
import {
  type ExtraProps,
  extractTableDataFromElement,
  StreamdownContext,
  type TableData,
  tableDataToCSV,
  tableDataToMarkdown,
} from "streamdown";
import { BlockActions, save } from "./block-actions";

// Tells spreadsheet apps that a CSV file is UTF-8.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** A table in an answer: hairlines only, with download and copy in the header's corner. */
export function Table({
  node: _,
  children,
  ...props
}: React.ComponentProps<"table"> & ExtraProps) {
  const ref = useRef<HTMLTableElement>(null);
  // A table still streaming in has nothing whole to copy yet.
  const { isAnimating } = useContext(StreamdownContext);

  return (
    <div data-slot="table" className="relative">
      <div className="scroll-fade-x scrollbar-thin overflow-x-auto rounded-[14px] border border-soft outline-offset-2 outline-ring focus-visible:outline-2">
        <table
          ref={ref}
          {...props}
          data-streamdown="table"
          className="w-full divide-y"
        >
          {children}
        </table>
      </div>
      {!isAnimating && (
        <BlockActions
          what="table"
          // Pinned to the corner in view: columns that scroll by slip under a
          // short fade instead of running into the buttons.
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

/** The table's cells as text, without the citation numbers inside them. */
function dataOf(table: HTMLTableElement): TableData {
  const copy = table.cloneNode(true) as HTMLTableElement;
  for (const citation of copy.querySelectorAll("[data-citation]")) {
    citation.remove();
  }
  return extractTableDataFromElement(copy);
}

function htmlOf({ headers, rows }: TableData): string {
  const row = (cells: string[], tag: "th" | "td") =>
    `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
  return `<table><thead>${row(headers, "th")}</thead><tbody>${rows
    .map((cells) => row(cells, "td"))
    .join("")}</tbody></table>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
