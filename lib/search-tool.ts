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
  merge,
  planRuns,
  type Run,
  type RunResult,
} from "./mixedbread/runs";
import type { SourceSelection } from "./sources";

export type SearchOutput =
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

export interface SearchContext {
  userId: string;
  connections: Connection[];
  selection: SourceSelection;
  /** Continues the conversation's source labels, see {@link nextLabel}. */
  firstLabel: number;
}

type RunEvent =
  | { type: "step"; step: Step; chunks: string[] }
  | { type: "end"; result: RunResult };

/** One Toast run; it reports how it ended instead of throwing, unless aborted. */
async function* run(
  userId: string,
  { connection, label, target }: Run<Connection>,
  query: string,
  signal: AbortSignal | undefined,
): AsyncGenerator<RunEvent> {
  try {
    const client = await clientFor(userId, connection);
    const names = new Map<string, string>();
    const listing =
      target.kind === "stores" &&
      fetchStores(client).then(
        (stores) => {
          for (const store of stores) names.set(store.id, store.name);
          return true;
        },
        // Without names, citations and steps show IDs.
        () => false,
      );
    // A deleted store fails the whole run, and picks outlive their stores.
    if (
      target.kind === "stores" &&
      target.stores !== "all" &&
      (await listing)
    ) {
      const stores = target.stores.filter((id) => names.has(id));
      if (stores.length === 0) {
        yield failed(`The stores picked in ${label} no longer exist.`);
        return;
      }
      target = { kind: "stores", stores };
    }
    for await (const event of research(client, query, target, signal)) {
      if (event.type === "step") {
        const { step } = event;
        if (step.store) step.store = names.get(step.store) ?? step.store;
        yield event;
        continue;
      }
      await listing;
      yield {
        type: "end",
        result: {
          status: "done",
          text: event.text,
          annotations: event.annotations,
          storeNames: names,
        },
      };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    yield failed(
      needsReconnect(error)
        ? `${label} needs to be connected again from the sources menu.`
        : "Mixedbread could not complete the search.",
    );
  }
}

function failed(message: string): RunEvent {
  return { type: "end", result: { status: "failed", message } };
}

export function searchTool(context: SearchContext) {
  const runs = planRuns(context.selection, context.connections);
  let label = context.firstLabel;

  return tool({
    description: describe(runs),
    inputSchema: z.object({
      query: z.string().describe("What to find out, with all needed context"),
    }),
    async *execute({ query }, { abortSignal }): AsyncGenerator<SearchOutput> {
      const started = Date.now();
      const several = runs.length > 1;
      const steps = new Map<string, Step>();
      const read = new Set<string>();
      const results: RunResult[] = [];

      const events = merge(
        runs.map((entry) => run(context.userId, entry, query, abortSignal)),
      );
      for await (const { index, value } of events) {
        if (value.type === "end") {
          results[index] = value.result;
          continue;
        }
        if (several) value.step.group = runs[index].label;
        steps.set(value.step.id, value.step);
        for (const chunk of value.chunks) read.add(chunk);
        yield { status: "searching", calls: Array.from(steps.values()) };
      }

      if (runs.length > 0 && !results.some((r) => r.status === "done")) {
        const [first] = results;
        throw new Error(first?.status === "failed" ? first.message : undefined);
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

function describe(runs: Run<Connection>[]): string {
  let web = false;
  let stores = false;
  for (const entry of runs) {
    if (entry.target.kind === "web") web = true;
    else stores = true;
  }
  const reach =
    web && stores
      ? "the user's Mixedbread stores and the web"
      : stores
        ? "the user's Mixedbread stores"
        : "the web";
  return `Search ${reach} with Toast, Mixedbread's search agent. It does not see this conversation, so write a complete, self-contained request.`;
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
