import type { Mixedbread } from "@mixedbread/sdk";
import type { ChatCreateCompletionParams } from "@mixedbread/sdk/resources/chat";
import { parseJsonEventStream } from "ai";
import { z } from "zod";

const WEB_STORE = "mixedbread/web";

/** A step of a Toast run, as the search trace shows it. */
export interface Step {
  id: string;
  kind: "search" | "grep" | "filter" | "metadata" | "read" | "stores" | "other";
  status: "running" | "done" | "failed";
  /** The API's name for a step of kind `other`. */
  tool?: string;
  /** "Web" or an organization's name, when a search spans several runs. */
  group?: string;
  /** The store Toast picked for the step, by name when known. */
  store?: string;
  queries?: string[];
  pattern?: string;
  filters?: { key: string; operator: string; value: unknown }[];
  /** The stores a `stores` step looked through. */
  stores?: { name: string; connectors?: string[] }[];
  /** Chunks the step returned or read. */
  results?: number;
  error?: string;
}

/** What a run searches: the web, or its organization's stores, all ("all") or some. */
export type ResearchTarget =
  | { kind: "web" }
  | { kind: "stores"; stores: "all" | string[] };

const annotationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("file_citation"),
    file_id: z.string(),
    filename: z.string(),
    index: z.number(),
    chunk_id: z.string(),
    store_id: z.string(),
  }),
  z.object({
    type: z.literal("url_citation"),
    url: z.string(),
    title: z.string(),
    start_index: z.number(),
    chunk_id: z.string(),
  }),
]);

export type Annotation = z.infer<typeof annotationSchema>;

export type ResearchEvent =
  | { type: "step"; step: Step; chunks: string[] }
  | { type: "answer"; text: string; annotations: Annotation[] };

const callSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["in_progress", "completed", "failed"]),
  queries: z.array(z.string()).nullish(),
  pattern: z.string().nullish(),
  chunk_ids: z.array(z.string()).nullish(),
  store: z.string().nullish(),
  metadata_filters: z
    .array(
      z.object({ key: z.string(), operator: z.string(), value: z.unknown() }),
    )
    .nullish(),
  stores: z
    .array(
      z.object({ name: z.string(), connectors: z.array(z.string()).nullish() }),
    )
    .nullish(),
  results: z.array(z.object({ chunk_id: z.string() })).nullish(),
  error: z.object({ message: z.string() }).nullish(),
});

// Steps and annotations are parsed one by one, so a shape the app doesn't
// know yet is skipped instead of failing the run.
const chunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().nullish(),
        annotations: z.array(z.unknown()).nullish(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  hosted_tool_calls: z.array(z.unknown()).nullish(),
});

// The API also streams deprecated aliases of some step types.
const kinds: Record<string, Step["kind"]> = {
  search_corpus_call: "search",
  store_search_call: "search",
  grep_call: "grep",
  store_grep_call: "grep",
  filter_chunks_call: "filter",
  store_list_chunks_call: "filter",
  inspect_metadata_call: "metadata",
  store_metadata_facets_call: "metadata",
  get_chunks_call: "read",
  list_stores_call: "stores",
};

const statuses = {
  in_progress: "running",
  completed: "done",
  failed: "failed",
} as const;

const WITH_RESULTS = new Set([
  "search_corpus",
  "grep",
  "filter_chunks",
  "get_chunks",
]);

function toolsFor(target: ResearchTarget): ChatCreateCompletionParams.Tool[] {
  if (target.kind === "web") {
    return [
      {
        type: "search_corpus",
        store_identifiers: [WEB_STORE],
        citations: true,
      },
    ];
  }
  // Without store IDs, Toast picks a store per step from what list_stores shows it.
  const store_identifiers = target.stores === "all" ? undefined : target.stores;
  const tools: ChatCreateCompletionParams.Tool[] = [
    { type: "search_corpus", store_identifiers, citations: true },
    { type: "grep", store_identifiers, citations: true },
    { type: "filter_chunks", store_identifiers, citations: true },
    { type: "inspect_metadata", store_identifiers },
    { type: "get_chunks", store_identifiers },
  ];
  if (!store_identifiers) tools.push({ type: "list_stores" });
  return tools;
}

/** Lets Toast 1 search `target` for `query`, streaming each step, then its cited answer. */
export async function* research(
  client: Mixedbread,
  query: string,
  target: ResearchTarget,
  signal?: AbortSignal,
): AsyncGenerator<ResearchEvent> {
  const tools = toolsFor(target);
  const include: string[] = [];
  for (const tool of tools) {
    if (tool.type && WITH_RESULTS.has(tool.type)) {
      include.push(`${tool.type}_call.results`);
    }
  }
  const response = await client.chat
    .createCompletion(
      {
        model: "toast-1",
        messages: [
          { role: "system", content: instructions() },
          { role: "user", content: query },
        ],
        tools,
        include,
        context_management: { edits: [{ type: "prune_context" }] },
        stream: true,
      },
      { signal },
    )
    .asResponse();
  if (!response.body) throw new Error("Mixedbread returned an empty stream.");

  let text = "";
  const annotations: Annotation[] = [];
  let finished = false;
  for await (const chunk of parseJsonEventStream({
    stream: response.body,
    schema: chunkSchema,
  })) {
    if (!chunk.success) throw chunk.error;
    for (const raw of chunk.value.hosted_tool_calls ?? []) {
      const call = callSchema.safeParse(raw);
      if (call.success) yield stepOf(call.data);
    }
    for (const choice of chunk.value.choices) {
      text += choice.delta.content ?? "";
      for (const raw of choice.delta.annotations ?? []) {
        const annotation = annotationSchema.safeParse(raw);
        if (annotation.success) annotations.push(annotation.data);
      }
      if (choice.finish_reason) finished = true;
    }
  }
  if (!finished) {
    throw new Error("The Mixedbread stream ended before the answer finished.");
  }
  yield { type: "answer", text, annotations };
}

function stepOf(call: z.infer<typeof callSchema>): ResearchEvent {
  const kind = kinds[call.type] ?? "other";
  const step: Step = { id: call.id, kind, status: statuses[call.status] };
  if (kind === "other") step.tool = call.type;
  if (call.queries?.length) step.queries = call.queries;
  if (call.pattern) step.pattern = call.pattern;
  if (call.store && call.store !== WEB_STORE) step.store = call.store;
  if (call.metadata_filters?.length) step.filters = call.metadata_filters;
  if (call.stores) {
    step.stores = [];
    for (const store of call.stores) {
      step.stores.push(
        store.connectors?.length
          ? { name: store.name, connectors: store.connectors }
          : { name: store.name },
      );
    }
  }
  const chunks: string[] = [];
  for (const result of call.results ?? []) chunks.push(result.chunk_id);
  const results = call.results ? chunks.length : call.chunk_ids?.length;
  if (results !== undefined) step.results = results;
  if (call.error) step.error = call.error.message;
  return { type: "step", step, chunks };
}

// Any instructions replace Toast's default prompt, and without today's date
// Toast assumes the year from memory when it searches the web.
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
