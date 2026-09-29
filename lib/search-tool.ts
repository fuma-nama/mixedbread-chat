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
  type RunResult,
  resolveTarget,
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

interface SearchContext {
  userId: string;
  connections: Connection[];
  selection: SourceSelection;
  /** Continues the conversation's source labels. */
  firstLabel: number;
  /**
   * Toast answers the chat itself: it reads the whole conversation, and its
   * findings are the answer, see `lib/toast-model.ts`.
   */
  toast: boolean;
}

type RunEvent =
  | { type: "step"; step: Step; chunks: string[] }
  | { type: "end"; result: RunResult };

/** One Toast run; it reports how it ended instead of throwing, unless aborted. */
async function* run(
  userId: string,
  entry: Run,
  turns: Turn[],
  signal: AbortSignal | undefined,
): AsyncGenerator<RunEvent> {
  const { connection, label, target } = entry;
  try {
    const client = await clientFor(userId, connection);
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
    // On auto, Toast searches while the names load; picks need them first.
    const resolved = resolveTarget(
      entry,
      target.kind === "stores" && target.stores !== "auto"
        ? await listing
        : undefined,
    );
    if ("error" in resolved) {
      yield failed(resolved.error);
      return;
    }
    for await (const event of research(client, turns, resolved, signal)) {
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
          citations: event.citations,
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
    async *execute(
      { query },
      { abortSignal, messages },
    ): AsyncGenerator<SearchOutput> {
      const started = Date.now();
      const several = runs.length > 1;
      const steps = new Map<string, Step>();
      const read = new Set<string>();
      const results: RunResult[] = [];

      const turns: Turn[] = context.toast
        ? turnsOf(messages)
        : [{ role: "user", content: query }];
      const events = merge(
        runs.map((entry) => run(context.userId, entry, turns, abortSignal)),
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

/** The conversation's text, for Toast answering the chat itself. */
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

function describe(runs: Run[]): string {
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
