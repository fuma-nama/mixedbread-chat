import { z } from "zod";
import { type Effort, reasoningLevels } from "./reasoning.ts";

/** A chat model on AI Gateway. Each can call tools, which search needs. */
export interface Model {
  id: string;
  name: string;
  /** Its name in the featured list, or the Gateway's ID for the rest. */
  provider: string;
  /** Listed up front; the rest of the catalog is a search away. */
  featured: boolean;
  /** The efforts it takes besides Auto, least to most. */
  efforts: Effort[];
  /** Toast itself, answering straight from the user's sources. */
  toast?: true;
}

const TOAST_MODEL = "mixedbread/toast-1";

/** Featured models by provider, grouped in this order. */
const featured = new Map([
  [TOAST_MODEL, "Mixedbread"],
  ["anthropic/claude-fable-5.1", "Anthropic"],
  ["anthropic/claude-opus-5.5", "Anthropic"],
  ["anthropic/claude-sonnet-5.5", "Anthropic"],
  ["anthropic/claude-sonnet-5", "Anthropic"],
  ["openai/gpt-6-sol", "OpenAI"],
  ["openai/gpt-6-luna", "OpenAI"],
  ["openai/gpt-5.6-terra", "OpenAI"],
  ["google/gemini-3.8-flash", "Google"],
  ["spacexai/grok-4.7", "xAI"],
  ["meta/muse-spark-1.3", "Meta"],
  ["mistral/mistral-medium-3.5", "Mistral"],
  ["deepseek/deepseek-v4-pro", "DeepSeek"],
  ["moonshotai/kimi-k3", "Moonshot AI"],
  ["alibaba/qwen3.8-max", "Alibaba"],
]);

export const defaultModel = "anthropic/claude-sonnet-5";

/** Names chats; a small, fast model is enough. */
export const titleModel = "openai/gpt-5.6-luna";

const CATALOG = "https://ai-gateway.vercel.sh/v1/models";
const REFRESH = 60 * 60 * 1000;
const RETRY = 60 * 1000;

let catalog: Model[] | undefined;
let expires = 0;
let refreshing: Promise<Model[]> | undefined;

/**
 * AI Gateway's catalog, refreshed hourly per server. The last one serves
 * while a new one loads, or when loading fails; before any, it is empty.
 */
export async function listModels(): Promise<Model[]> {
  if (Date.now() > expires) {
    refreshing ??= refresh();
    if (!catalog) return refreshing;
  }
  return catalog ?? [];
}

async function refresh(): Promise<Model[]> {
  try {
    catalog = await fetchCatalog();
    expires = Date.now() + REFRESH;
  } catch {
    expires = Date.now() + RETRY;
  }
  refreshing = undefined;
  return catalog ?? [];
}

const entrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  owned_by: z.string(),
  released: z.number().nullish(),
  tags: z.array(z.string()).nullish(),
  reasoning_options: z
    .array(
      z.object({ type: z.string(), values: z.array(z.string()).nullish() }),
    )
    .nullish(),
});

async function fetchCatalog(): Promise<Model[]> {
  const response = await fetch(CATALOG, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`AI Gateway returned ${response.status}.`);
  const { data } = z
    .object({ data: z.array(z.unknown()) })
    .parse(await response.json());

  const picks = new Map<string, Model>();
  const rest: { model: Model; released: number }[] = [];
  for (const raw of data) {
    // Entries are parsed one by one, so a shape the app doesn't know is skipped.
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) continue;
    const { id, name, type, owned_by, released, tags } = entry.data;
    if (type !== "language" || !tags?.includes("tool-use")) continue;
    const provider = featured.get(id);
    const model: Model = {
      id,
      name,
      provider: provider ?? owned_by,
      featured: provider !== undefined,
      efforts: effortsOf(entry.data.reasoning_options),
    };
    if (id === TOAST_MODEL) model.toast = true;
    if (provider) picks.set(id, model);
    else rest.push({ model, released: released ?? 0 });
  }

  const models: Model[] = [];
  for (const id of featured.keys()) {
    const model = picks.get(id);
    if (model) models.push(model);
  }
  rest.sort(
    (a, b) =>
      a.model.provider.localeCompare(b.model.provider) ||
      b.released - a.released,
  );
  for (const { model } of rest) models.push(model);
  return models;
}

function effortsOf(
  options: z.infer<typeof entrySchema>["reasoning_options"],
): Effort[] {
  const offered = new Set<string>();
  for (const option of options ?? []) {
    // A toggle can turn thinking off; an effort option lists its levels.
    if (option.type === "toggle") offered.add("none");
    for (const value of option.values ?? []) offered.add(value);
  }
  const efforts: Effort[] = [];
  for (const level of reasoningLevels) {
    if (level.id !== "auto" && offered.has(level.id)) efforts.push(level.id);
  }
  return efforts;
}
