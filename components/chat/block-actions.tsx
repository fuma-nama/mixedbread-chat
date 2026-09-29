"use client";

import { cn } from "cn";
import { DownloadIcon } from "lucide-react";
import { Action, CopyAction } from "./message-actions";

/**
 * Download and copy for a block inside an answer, a code block or a table.
 * They show on hover like a message's own actions (see `.markdown`).
 */
export function BlockActions({
  what,
  copy,
  download,
  className,
}: {
  /** What the block is, for the buttons' names: "code" or "table". */
  what: string;
  copy: () => Promise<void>;
  download: () => void;
  className?: string;
}) {
  return (
    // Copy comes first, as it does under messages.
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

/** Saves `text` as a file, as though it were downloaded. */
export function save(text: string, filename: string, type: string) {
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
