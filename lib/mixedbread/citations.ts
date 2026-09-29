import type { Annotation } from "./research";

export type Source =
  | { label: string; type: "url"; url: string; title: string }
  | {
      label: string;
      type: "file";
      fileId: string;
      filename: string;
      chunkId: string;
      storeId: string;
      storeName?: string;
    };

/**
 * Puts a `[label]` marker where each citation stood in Toast's answer, so
 * another model can cite the same evidence. Each cited page or chunk gets one
 * label from `nextLabel`.
 */
export function labelCitations(
  text: string,
  annotations: Annotation[],
  nextLabel: () => string,
): { text: string; sources: Source[] } {
  // Offsets count code points, as the server does; JS strings index UTF-16 units.
  const chars = Array.from(text);
  const sources = new Map<string, Source>();
  const markers = new Map<number, string>();

  for (const annotation of annotations) {
    const url = annotation.type === "url_citation";
    const key = url ? annotation.url : annotation.chunk_id;
    let source = sources.get(key);
    if (!source) {
      source = url
        ? {
            label: nextLabel(),
            type: "url",
            url: annotation.url,
            title: annotation.title,
          }
        : {
            label: nextLabel(),
            type: "file",
            fileId: annotation.file_id,
            filename: annotation.filename,
            chunkId: annotation.chunk_id,
            storeId: annotation.store_id,
          };
      sources.set(key, source);
    }

    const offset = url ? annotation.start_index : annotation.index;
    const at = Math.min(Math.max(offset, 0), chars.length);
    const marker = `[${source.label}]`;
    const existing = markers.get(at) ?? "";
    if (!existing.includes(marker)) markers.set(at, existing + marker);
  }

  let labelled = "";
  for (let i = 0; i <= chars.length; i++) {
    labelled += (markers.get(i) ?? "") + (chars[i] ?? "");
  }
  return { text: labelled, sources: Array.from(sources.values()) };
}

export function sourceTitle(source: Source): string {
  return source.type === "url" ? source.title || source.url : source.filename;
}
