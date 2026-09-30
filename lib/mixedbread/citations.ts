import type { Citation } from "./research";

/** A cited page or chunk; `excerpt` is the text Toast read there. */
export type Source = { label: string; excerpt?: string } & (
  | { type: "url"; url: string; title: string }
  | {
      type: "file";
      fileId: string;
      filename: string;
      chunkId: string;
      /** Its place in the file, from 0: for a visually parsed PDF, its page. */
      chunkIndex: number;
      storeId: string;
      storeName?: string;
      /** Whose store it is, for showing its page. */
      organizationId?: string;
      /** A page or picture that can be shown. */
      image?: true;
      /** The sentence that cited it first, to find on its page. */
      claim?: string;
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
    const at = Math.min(Math.max(citation.at, 0), chars.length);
    const key = citation.type === "url" ? citation.url : citation.chunkId;
    let source = sources.get(key);
    if (!source) {
      // A page cited at several chunks previews the first.
      const { at: _, ...cited } = citation;
      source = { label: nextLabel(), ...cited };
      if (source.type === "file" && source.image) {
        source.claim = claimAt(chars, at);
      }
      sources.set(key, source);
    }

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

/** The sentence ending where a citation stands, at most a paragraph long. */
function claimAt(chars: string[], at: number): string {
  let end = at;
  while (end > 0 && /[\s.!?]/.test(chars[end - 1])) end--;
  let start = end;
  while (start > end - 400 && start > 0 && !/[.!?\n]/.test(chars[start - 1])) {
    start--;
  }
  return chars.slice(start, end).join("").trim();
}

export function sourceTitle(source: Source): string {
  return source.type === "url" ? source.title || source.url : source.filename;
}

/** Where a source is from: the store it was found in, or its site. */
export function originOf(source: Source): string {
  if (source.type === "file") return source.storeName ?? "Your files";
  return URL.parse(source.url)?.hostname.replace(/^www\./, "") ?? source.url;
}
