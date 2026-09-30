import type { Mixedbread } from "@mixedbread/sdk";
import { type InferUITools, type ModelMessage, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Source } from "./mixedbread/citations";
import {
  type Connection,
  clientFor,
  fetchStores,
  needsReconnect,
} from "./mixedbread/organizations";
import { research, type Step, type Turn } from "./mixedbread/research";
import {
  combine,
  merge,
  planRuns,
  type Run,
  type RunEvent,
  type RunResult,
  resolveTarget,
} from "./mixedbread/runs";
import type { SourceSelection } from "./sources";

type SearchOutput =
  | { status: "searching"; calls: Step[] }
  | {
      status: "done";
      calls: Step[];
      findings: string;
      sources: Source[];
      /** Distinct chunks the steps returned. */
      read: number;
      ms: number;
    };

interface SearchContext {
  userId: string;
  connections: Connection[];
  selection: SourceSelection;
  /** Continues the conversation's source labels. */
  firstLabel: number;
  /** Toast answers the chat itself, from the whole conversation. */
  toast: boolean;
}

/** One Toast run; it reports how it ended instead of throwing, unless aborted. */
async function* run(
  clientOf: (connection: Connection) => Promise<Mixedbread>,
  entry: Run,
  turns: Turn[],
  signal: AbortSignal | undefined,
): AsyncGenerator<RunEvent> {
  const { connection, label, target } = entry;
  try {
    const client = await clientOf(connection);
    const names = new Map<string, string>();
    const listing =
      target.kind === "stores"
        ? fetchStores(client).then(
            (stores) => {
              for (const store of stores) names.set(store.id, store.name);
              return names;
            },
            // Without names, citations and steps show IDs.
            () => undefined,
          )
        : undefined;
    const resolved = await resolveTarget(entry, listing);
    if ("error" in resolved) {
      yield { type: "failed", message: resolved.error };
      return;
    }
    for await (const event of research(client, turns, resolved, signal)) {
      if (event.type === "step") {
        const { step } = event;
        if (step.store) step.store = names.get(step.store) ?? step.store;
      } else {
        await listing;
        for (const citation of event.citations) {
          if (citation.type !== "file") continue;
          const name = names.get(citation.storeId);
          if (name) citation.storeName = name;
          citation.organizationId = connection.organizationId;
        }
      }
      yield event;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    yield {
      type: "failed",
      message: needsReconnect(error)
        ? `${label} needs to be connected again from the sources menu.`
        : "Mixedbread could not complete the search.",
    };
  }
}

export function searchTool(context: SearchContext) {
  const runs = planRuns(context.selection, context.connections);
  const web = runs.some(({ target }) => target.kind === "web");
  const reach = runs.some(({ target }) => target.kind === "stores")
    ? `the user's Mixedbread stores${web ? " and the web" : ""}`
    : "the web";
  let label = context.firstLabel;

  return tool({
    description: `Search ${reach} with Toast, Mixedbread's search agent. It does not see this conversation, so write a complete, self-contained request.`,
    inputSchema: z.object({
      query: z.string().describe("What to find out, with all needed context"),
    }),
    async *execute(
      { query },
      { abortSignal, messages },
    ): AsyncGenerator<SearchOutput> {
      const started = Date.now();
      const steps = new Map<string, Step>();
      const read = new Set<string>();
      const results: RunResult[] = [];

      const turns: Turn[] = context.toast
        ? turnsOf(messages)
        : [{ role: "user", content: query }];
      // The web run borrows an organization's token, fetched once for both.
      const clients = new Map<Connection, Promise<Mixedbread>>();
      function clientOf(connection: Connection) {
        const client =
          clients.get(connection) ?? clientFor(context.userId, connection);
        clients.set(connection, client);
        return client;
      }
      const events = merge(
        runs.map((entry) => run(clientOf, entry, turns, abortSignal)),
      );
      for await (const { index, value } of events) {
        if (value.type !== "step") {
          results[index] = value;
          continue;
        }
        if (runs.length > 1) value.step.group = runs[index].label;
        steps.set(value.step.id, value.step);
        for (const chunk of value.chunks) read.add(chunk);
        yield { status: "searching", calls: Array.from(steps.values()) };
      }

      if (runs.length > 0 && results.every((r) => r.type === "failed")) {
        throw new Error(results[0].message);
      }
      const { findings, sources } = combine(runs, results, () => `S${label++}`);
      yield {
        status: "done",
        calls: Array.from(steps.values()),
        findings: findings || "No sources are picked, so nothing was searched.",
        sources,
        read: read.size,
        ms: Date.now() - started,
      };
    },
    toModelOutput({ output }) {
      if (output.status !== "done") {
        return { type: "text", value: "The search did not finish." };
      }
      if (context.toast) return { type: "text", value: output.findings };
      let value = output.findings;
      if (output.sources.length > 0) value += "\n\nSources:";
      for (const source of output.sources) {
        value += `\n[${source.label}] `;
        if (source.type === "url") value += `${source.title} (${source.url})`;
        else if (source.storeName) {
          value += `${source.filename}, in the store "${source.storeName}"`;
        } else value += source.filename;
      }
      return { type: "text", value };
    },
  });
}

function turnsOf(messages: ModelMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const { role, content } of messages) {
    if (role !== "user" && role !== "assistant") continue;
    let text = "";
    if (typeof content === "string") text = content;
    else {
      for (const part of content) if (part.type === "text") text += part.text;
    }
    if (text) turns.push({ role, content: text });
  }
  return turns;
}

export type ChatMessage = UIMessage<
  unknown,
  /** Sent once the chat is named; not kept in the message. */
  { title: string },
  InferUITools<{ search: ReturnType<typeof searchTool> }>
>;
