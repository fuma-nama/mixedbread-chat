import { type Source, sourceTitle } from "./mixedbread/citations";
import type { ChatMessage } from "./search-tool";

/** The sources a message cites, by label, numbered in order of first citation. */
export type Citations = Map<string, { number: number; source: Source }>;

const CITATION = /\]\(#(S\d+)\)/g;
const CITATION_LINK = /\[[^\]]*\]\(#(S\d+)\)/g;

/** What the message's finished searches found. */
function* sourcesOf(message: ChatMessage): Generator<Source> {
  for (const part of message.parts) {
    if (
      part.type === "tool-search" &&
      part.state === "output-available" &&
      part.output.status === "done"
    ) {
      yield* part.output.sources;
    }
  }
}

/** Source labels stay unique across a conversation, so a later answer can cite an earlier search. */
export function nextLabel(messages: ChatMessage[]): number {
  let last = 0;
  for (const message of messages) {
    for (const { label } of sourcesOf(message)) {
      last = Math.max(last, Number(label.slice(1)));
    }
  }
  return last + 1;
}

// A message never changes once it is done, and neither do its citations.
const cache = new WeakMap<ChatMessage, Citations>();

/**
 * The citations of each message on a path: its `[S1](#S1)` links to sources
 * found up to and including it.
 */
export function citationsAlong(messages: ChatMessage[]): Citations[] {
  const sources = new Map<string, Source>();
  const all: Citations[] = [];
  for (const message of messages) {
    for (const source of sourcesOf(message)) sources.set(source.label, source);
    let citations = cache.get(message);
    if (!citations) {
      citations = new Map();
      for (const part of message.parts) {
        if (part.type !== "text") continue;
        for (const [, label] of part.text.matchAll(CITATION)) {
          const source = sources.get(label);
          if (source && !citations.has(label)) {
            citations.set(label, { number: citations.size + 1, source });
          }
        }
      }
      cache.set(message, citations);
    }
    all.push(citations);
  }
  return all;
}

function joinedText(message: ChatMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
  }
  return text;
}

/** The message's text as the reader sees it, without citation links. */
export function textOf(message: ChatMessage): string {
  return joinedText(message).replace(CITATION_LINK, "");
}

/** The text with citations as [n] markers and a list of sources, for pasting elsewhere. */
export function copyTextOf(message: ChatMessage, citations: Citations): string {
  const text = joinedText(message).replace(
    CITATION_LINK,
    (_, label: string) => {
      const citation = citations.get(label);
      return citation ? `[${citation.number}]` : "";
    },
  );
  if (citations.size === 0) return text;

  let notes = "";
  for (const { number, source } of citations.values()) {
    notes += `\n[${number}] ${sourceTitle(source)}`;
    if (source.type === "url") notes += ` (${source.url})`;
  }
  return `${text}\n\nSources:${notes}`;
}
