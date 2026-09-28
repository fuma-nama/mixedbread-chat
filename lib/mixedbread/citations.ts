export type Annotation =
  | {
      type: "file_citation";
      file_id: string;
      filename: string;
      index: number;
      chunk_id: string;
      store_id: string;
    }
  | {
      type: "url_citation";
      url: string;
      title: string;
      start_index: number;
      end_index: number;
      chunk_id: string;
    };

export type Source =
  | { label: string; type: "url"; url: string; title: string }
  | {
      label: string;
      type: "file";
      fileId: string;
      filename: string;
      chunkId: string;
      storeId: string;
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
    const key =
      annotation.type === "url_citation" ? annotation.url : annotation.chunk_id;
    let source = sources.get(key);
    if (!source) {
      source = toSource(annotation, nextLabel());
      sources.set(key, source);
    }

    const offset =
      annotation.type === "url_citation"
        ? annotation.start_index
        : annotation.index;
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

function toSource(annotation: Annotation, label: string): Source {
  if (annotation.type === "url_citation") {
    return {
      label,
      type: "url",
      url: annotation.url,
      title: annotation.title,
    };
  }
  return {
    label,
    type: "file",
    fileId: annotation.file_id,
    filename: annotation.filename,
    chunkId: annotation.chunk_id,
    storeId: annotation.store_id,
  };
}
