"use client";

import { cn } from "cn";
import { DownloadIcon } from "lucide-react";
import { Action, CopyAction } from "./message-actions";

/** Copy and download for a code block or table; `.markdown` shows them on hover. */
export function BlockActions({
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
