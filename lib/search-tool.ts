import type { Mixedbread } from "@mixedbread/sdk";
import { type InferUITools, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Source } from "./mixedbread/citations";
import {
  type Connection,
  clientFor,
  fetchStores,
  needsReconnect,
} from "./mixedbread/organizations";
import { research, type Step } from "./mixedbread/research";
import {
  combine,
  type FoundStores,
  findStores,
  merge,
  planRuns,
  type Run,
  type RunEvent,
  type RunResult,
  resolveTarget,
} from "./mixedbread/runs";
import type { SearchScope, SourceSelection } from "./sources";

/** `started` is when it began, by the server's clock. */
type SearchOutput =
  | { status: "searching"; calls: Step[]; started: number }
  | {
      status: "done";
      calls: Step[];
      started: number;
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
  scope: SearchScope;
  firstLabel: number;
}

/** One Toast run; it reports how it ended instead of throwing, unless aborted. */
async function* run(
  clientOf: (connection: Connection) => Promise<Mixedbread>,
  entry: Run,
  query: string,
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
    for await (const event of research(client, query, resolved, signal)) {
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

export function findStoresTool({
  userId,
  connections,
  selection,
}: SearchContext) {
  return tool({
    description:
      "Find the user's stores to pass to search: up to 20 per organization whose name or description contains the query, or else the newest.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'A word from the name or description of a store, like "legal"',
        ),
    }),
    // An inferred type would loop back through ChatMessage.
    execute: ({ query }): Promise<FoundStores[]> =>
      findStores(
        selection,
        connections,
        (connection) => clientFor(userId, connection),
        query,
      ),
  });
}

export function searchTool(context: SearchContext) {
  const reach =
    context.scope === "web"
      ? "the web"
      : `the user's Mixedbread stores${context.scope === "both" ? " and the web" : ""}`;
  let label = context.firstLabel;

  return tool({
    description: `Search ${reach} with Toast, Mixedbread's search agent. It does not see this conversation, so write a complete, self-contained request.`,
    inputSchema: z.object({
      query: z.string().describe("What to find out, with all needed context"),
      stores: z
        .array(z.object({ organization: z.string(), ids: z.array(z.string()) }))
        .optional()
        .describe(
          "The stores to search, from find_stores: an organization ID with the IDs of its stores",
        ),
    }),
    async *execute(
      { query, stores },
      { abortSignal },
    ): AsyncGenerator<SearchOutput> {
      const runs = planRuns(context.selection, context.connections, stores);
      const started = Date.now();
      const steps = new Map<string, Step>();
      const read = new Set<string>();
      const results: RunResult[] = [];

      // The web run borrows an organization's token, fetched once for both.
      const clients = new Map<Connection, Promise<Mixedbread>>();
      function clientOf(connection: Connection) {
        const client =
          clients.get(connection) ?? clientFor(context.userId, connection);
        clients.set(connection, client);
        return client;
      }
      const events = merge(
        runs.map((entry) => run(clientOf, entry, query, abortSignal)),
      );
      yield { status: "searching", calls: [], started };
      for await (const { index, value } of events) {
        if (value.type !== "step") {
          results[index] = value;
          continue;
        }
        if (runs.length > 1) value.step.group = runs[index].label;
        steps.set(value.step.id, value.step);
        for (const chunk of value.chunks) read.add(chunk);
        yield {
          status: "searching",
          calls: Array.from(steps.values()),
          started,
        };
      }

      if (runs.length > 0 && results.every((r) => r.type === "failed")) {
        throw new Error(results[0].message);
      }
      const { findings, sources } = combine(runs, results, () => `S${label++}`);
      yield {
        status: "done",
        calls: Array.from(steps.values()),
        started,
        findings:
          findings ||
          "Nothing was searched. Search again with stores from find_stores.",
        sources,
        read: read.size,
        ms: Date.now() - started,
      };
    },
    toModelOutput({ output }) {
      if (output.status !== "done") {
        return { type: "text", value: "The search did not finish." };
      }
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

export type ChatMessage = UIMessage<
  unknown,
  {
    /** How an answer ended short of done. */
    ended: "stopped" | "failed";
  },
  InferUITools<{
    find_stores: ReturnType<typeof findStoresTool>;
    search: ReturnType<typeof searchTool>;
  }>
>;
