import type { Mixedbread } from "@mixedbread/sdk";
import { EventSourceParserStream } from "eventsource-parser/stream";
import type { Annotation } from "./citations";

export const WEB_STORE = "mixedbread/web";

/** One server-side step of a Toast run, reported when it starts and again when it ends. */
export interface HostedCall {
  id: string;
  type: string;
  status: "in_progress" | "completed" | "failed";
  queries?: string[];
  pattern?: string | null;
  chunk_ids?: string[];
}

export type ResearchEvent =
  | { type: "call"; call: HostedCall }
  | { type: "answer"; text: string; annotations: Annotation[] };

interface CompletionChunk {
  choices: {
    delta: { content?: string | null; annotations?: Annotation[] | null };
  }[];
  hosted_tool_calls?: HostedCall[] | null;
}

export interface ResearchOptions {
  query: string;
  /** Store names or IDs; include `mixedbread/web` to search the web. */
  stores: string[];
  signal?: AbortSignal;
}

/** Lets Toast 1 search `stores` for `query`, streaming each step, then its cited answer. */
export async function* research(
  client: Mixedbread,
  { query, stores, signal }: ResearchOptions,
): AsyncGenerator<ResearchEvent> {
  const response = await client.chat
    .createCompletion(
      {
        model: "toast-1",
        messages: [
          { role: "system", content: instructions() },
          { role: "user", content: query },
        ],
        tools: stores.some((store) => store !== WEB_STORE)
          ? [
              {
                type: "search_corpus",
                store_identifiers: stores,
                citations: true,
              },
              { type: "grep", store_identifiers: stores, citations: true },
              {
                type: "filter_chunks",
                store_identifiers: stores,
                citations: true,
              },
              { type: "inspect_metadata", store_identifiers: stores },
              { type: "get_chunks", store_identifiers: stores },
            ]
          : [
              {
                type: "search_corpus",
                store_identifiers: stores,
                citations: true,
              },
            ],
        context_management: { edits: [{ type: "prune_context" }] },
        stream: true,
      },
      { signal },
    )
    .asResponse();
  if (!response.body) throw new Error("Mixedbread returned an empty stream.");

  const events = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream());
  let text = "";
  const annotations: Annotation[] = [];

  for await (const { data } of events) {
    if (data === "[DONE]") {
      yield { type: "answer", text, annotations };
      return;
    }
    const chunk: CompletionChunk = JSON.parse(data);
    for (const call of chunk.hosted_tool_calls ?? []) {
      yield { type: "call", call };
    }
    for (const { delta } of chunk.choices) {
      text += delta.content ?? "";
      if (delta.annotations) annotations.push(...delta.annotations);
    }
  }
  throw new Error("The Mixedbread stream ended before the answer finished.");
}

/**
 * Toast's default search-agent prompt plus today's date. Any instructions
 * replace the default prompt, and without both parts Toast assumes the year
 * from memory when it searches the web.
 */
function instructions(): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const day = (date: Date) => date.toISOString().slice(0, 10);

  return `You are a search agent over the user's connected stores. Use the search tools you were given to explore the corpus regarding the user's query.

Runtime context:
- Current UTC date: ${day(today)}.
- Relative date queries use this UTC date unless the user gives another timezone; yesterday is ${day(yesterday)}.`;
}
