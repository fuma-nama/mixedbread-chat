import type { Mixedbread } from "@mixedbread/sdk";
import type { ChatCreateCompletionParams } from "@mixedbread/sdk/resources/chat";
import { parseJsonEventStream } from "ai";
import { z } from "zod";
import type { Citation } from "./citations.ts";
import { splitChunkId } from "./files.ts";

const WEB_STORE = "mixedbread/web";

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
  stores?: { name: string }[];
  /** Chunks it returned or read. */
  results?: number;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** The web, or the organization's stores: Toast picks among them ("auto"), or these. */
export type ResearchTarget =
  | { kind: "web" }
  | { kind: "stores"; stores: "auto" | string[] };

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

export type ResearchEvent =
  | { type: "step"; step: Step; chunks: string[] }
  | { type: "answer"; text: string; citations: Citation[] };

const resultSchema = z.object({
  chunk_id: z.string(),
  file_title: z.string().nullish(),
  mime_type: z.string().nullish(),
  text: z.string().nullish(),
  ocr_text: z.string().nullish(),
  transcription: z.string().nullish(),
  summary: z.string().nullish(),
});

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
  stores: z.array(z.object({ name: z.string() })).nullish(),
  results: z.array(resultSchema).nullish(),
});

// Steps and annotations are parsed one by one, so an unknown shape is skipped.
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

const kinds: Record<string, Step["kind"]> = {
  search_corpus_call: "search",
  grep_call: "grep",
  filter_chunks_call: "filter",
  inspect_metadata_call: "metadata",
  get_chunks_call: "read",
  list_stores_call: "stores",
};

const statuses = {
  in_progress: "running",
  completed: "done",
  failed: "failed",
} as const;

// Steps carry the chunks they read only when asked; extra keys are ignored.
const include = [
  "search_corpus_call.results",
  "grep_call.results",
  "filter_chunks_call.results",
  "get_chunks_call.results",
];

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
  const store_identifiers =
    target.stores === "auto" ? undefined : target.stores;
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

/** Streams each step of Toast's search, then its cited answer. */
export async function* research(
  client: Mixedbread,
  turns: Turn[],
  target: ResearchTarget,
  signal?: AbortSignal,
): AsyncGenerator<ResearchEvent> {
  const response = await client.chat
    .createCompletion(
      {
        model: "toast-1",
        messages: [{ role: "system", content: instructions() }, ...turns],
        tools: toolsFor(target),
        include,
        context_management: { edits: [{ type: "prune_context" }] },
        stream: true,
      },
      { signal },
    )
    .asResponse();
  if (!response.body) throw new Error("Mixedbread returned an empty stream.");

  let text = "";
  const annotations: z.infer<typeof annotationSchema>[] = [];
  const seen = new Map<string, { excerpt?: string; image: boolean }>();
  let finished = false;
  for await (const chunk of parseJsonEventStream({
    stream: response.body,
    schema: chunkSchema,
  })) {
    if (!chunk.success) throw chunk.error;
    for (const raw of chunk.value.hosted_tool_calls ?? []) {
      const call = callSchema.safeParse(raw);
      if (!call.success) continue;
      const chunks: string[] = [];
      for (const result of call.data.results ?? []) {
        chunks.push(result.chunk_id);
        if (seen.has(result.chunk_id)) continue;
        seen.set(result.chunk_id, {
          excerpt: excerptOf(result),
          image: result.mime_type?.startsWith("image/") ?? false,
        });
      }
      yield { type: "step", step: stepOf(call.data), chunks };
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
  const citations = annotations.map((annotation) => {
    const citation: Citation =
      annotation.type === "url_citation"
        ? {
            type: "url",
            at: annotation.start_index,
            url: annotation.url,
            title: annotation.title,
          }
        : {
            type: "file",
            at: annotation.index,
            fileId: annotation.file_id,
            filename: annotation.filename,
            chunkId: annotation.chunk_id,
            chunkIndex: splitChunkId(annotation.chunk_id)[1],
            storeId: annotation.store_id,
          };
    const read = seen.get(annotation.chunk_id);
    if (read?.excerpt) citation.excerpt = read.excerpt;
    if (read?.image && citation.type === "file") citation.image = true;
    return citation;
  });
  yield { type: "answer", text, citations };
}

const EXCERPT_LENGTH = 600;
// Where the harness shortened a chunk for Toast's context.
const CUT = /…?\[(?:\.\.\. )?truncated: [^\]]*\]…?/g;

function excerptOf(result: z.infer<typeof resultSchema>): string | undefined {
  let text =
    result.text || result.ocr_text || result.transcription || result.summary;
  if (!text) return;
  // Web pages open with their title, which the citation shows already.
  if (result.file_title && text.startsWith(result.file_title)) {
    text = text.slice(result.file_title.length);
  }
  text = text.replaceAll(CUT, "…").trim();
  if (text.length <= EXCERPT_LENGTH) return text;
  const end = text.lastIndexOf(" ", EXCERPT_LENGTH);
  return `${text.slice(0, end > 0 ? end : EXCERPT_LENGTH)}…`;
}

function stepOf(call: z.infer<typeof callSchema>): Step {
  const kind = kinds[call.type] ?? "other";
  const step: Step = { id: call.id, kind, status: statuses[call.status] };
  if (kind === "other") step.tool = call.type;
  if (call.queries?.length) step.queries = call.queries;
  if (call.pattern) step.pattern = call.pattern;
  if (call.store && call.store !== WEB_STORE) step.store = call.store;
  if (call.metadata_filters?.length) step.filters = call.metadata_filters;
  if (call.stores) step.stores = call.stores;
  const results = call.results?.length ?? call.chunk_ids?.length;
  if (results !== undefined) step.results = results;
  return step;
}

// Any instructions replace Toast's default prompt, and without today's date
// Toast assumes the year from memory when it searches the web.
function instructions(): string {
  const now = Date.now();
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return `You are a search agent over the user's connected stores. Use the search tools you were given to explore the corpus regarding the user's query.

Runtime context:
- Current UTC date: ${day(now)}.
- Relative date queries use this UTC date unless the user gives another timezone; yesterday is ${day(now - 86_400_000)}.`;
}
