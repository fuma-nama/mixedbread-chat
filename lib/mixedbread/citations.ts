import type { Citation } from "./research";

/** A cited page or chunk; `excerpt` is the text Toast read there. */
export type Source = { label: string; excerpt?: string } & (
  | { type: "url"; url: string; title: string }
  | {
      type: "file";
      fileId: string;
      filename: string;
      chunkId: string;
      storeId: string;
      storeName?: string;
    }
);

/**
 * Puts a `[label]` marker where each citation stood in Toast's answer, so
 * another model can cite the same evidence. Each cited page or chunk gets one
 * label from `nextLabel`.
 */
export function labelCitations(
  text: string,
  citations: Citation[],
  nextLabel: () => string,
): { text: string; sources: Source[] } {
  // Offsets count code points, as the server does; JS strings index UTF-16 units.
  const chars = Array.from(text);
  const sources = new Map<string, Source>();
  const markers = new Map<number, string>();

  for (const citation of citations) {
    const key = citation.type === "url" ? citation.url : citation.chunkId;
    let source = sources.get(key);
    if (!source) {
      source =
        citation.type === "url"
          ? {
              label: nextLabel(),
              type: "url",
              url: citation.url,
              title: citation.title,
            }
          : {
              label: nextLabel(),
              type: "file",
              fileId: citation.fileId,
              filename: citation.filename,
              chunkId: citation.chunkId,
              storeId: citation.storeId,
            };
      // A page cited at several chunks previews the first.
      if (citation.excerpt) source.excerpt = citation.excerpt;
      sources.set(key, source);
    }

    const at = Math.min(Math.max(citation.at, 0), chars.length);
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
