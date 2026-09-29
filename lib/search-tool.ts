import { Mixedbread } from "@mixedbread/sdk";
import { type InferUITools, tool, type UIMessage } from "ai";
import { z } from "zod";
import { labelCitations, type Source } from "./mixedbread/citations";
import { type HostedCall, research, WEB_STORE } from "./mixedbread/research";

const stores = process.env.MXBAI_STORES?.match(/[^\s,]+/g) ?? [WEB_STORE];

export type SearchScope = "web" | "docs" | "both";

/** What the search can reach, so the UI never promises documents it cannot see. */
export const searchScope: SearchScope = stores.every(
  (store) => store === WEB_STORE,
)
  ? "web"
  : stores.includes(WEB_STORE)
    ? "both"
    : "docs";

export type SearchOutput =
  | { status: "searching"; calls: HostedCall[] }
  | {
      status: "done";
      calls: HostedCall[];
      findings: string;
      sources: Source[];
      /** How long the search took; missing on chats saved before it was kept. */
      ms?: number;
    };

/** `firstLabel` continues the conversation's source labels, see {@link nextLabel}. */
export function searchTool(firstLabel: number) {
  const client = new Mixedbread();
  let label = firstLabel;

  return tool({
    description:
      "Search the user's documents and the web with a search agent. It does not see this conversation, so write a complete, self-contained request.",
    inputSchema: z.object({
      query: z.string().describe("What to find out, with all needed context"),
    }),
    async *execute({ query }, { abortSignal }): AsyncGenerator<SearchOutput> {
      const started = Date.now();
      const calls = new Map<string, HostedCall>();
      for await (const event of research(client, {
        query,
        stores,
        signal: abortSignal,
      })) {
        if (event.type === "call") {
          calls.set(event.call.id, event.call);
          yield { status: "searching", calls: Array.from(calls.values()) };
          continue;
        }
        const { text, sources } = labelCitations(
          event.text,
          event.annotations,
          () => `S${label++}`,
        );
        yield {
          status: "done",
          calls: Array.from(calls.values()),
          findings: text,
          sources,
          ms: Date.now() - started,
        };
      }
    },
    toModelOutput({ output }) {
      if (output.status !== "done") {
        return { type: "text", value: "The search did not finish." };
      }
      let value = output.findings;
      if (output.sources.length > 0) value += "\n\nSources:";
      for (const source of output.sources) {
        value += `\n[${source.label}] ${source.type === "url" ? `${source.title} (${source.url})` : source.filename}`;
      }
      return { type: "text", value };
    },
  });
}

export type ChatMessage = UIMessage<
  unknown,
  /** Sent once the chat is named; not kept in the message. */
  { title: string },
  InferUITools<{ search: ReturnType<typeof searchTool> }>
>;

/** Source labels stay unique across a conversation, so a later answer can cite an earlier search. */
export function nextLabel(messages: ChatMessage[]): number {
  let last = 0;
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-search" || part.state !== "output-available")
        continue;
      if (part.output.status !== "done") continue;
      for (const source of part.output.sources) {
        last = Math.max(last, Number(source.label.slice(1)));
      }
    }
  }
  return last + 1;
}
