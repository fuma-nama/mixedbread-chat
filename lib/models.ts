import { z } from "zod";
import { type Effort, reasoningLevels } from "./reasoning.ts";

/** A chat model on AI Gateway. Each can call tools, which search needs. */
export interface Model {
  id: string;
  name: string;
  /** The Gateway's ID for its provider, which groups it in the picker. */
  provider: string;
  /** The efforts it takes besides Auto, least to most. */
  efforts: Effort[];
  /** Toast itself, answering straight from the user's sources. */
  toast?: true;
}

const TOAST_MODEL = "mixedbread/toast-1";

/** A deployment's own list, such as a demo's, the first picked by default. */
const allowed = process.env.ALLOWED_MODELS?.match(/[^\s,]+/g) ?? undefined;

export const defaultModel = allowed?.[0] ?? "anthropic/claude-sonnet-5";

/** Names chats: small, quick, and on AI Gateway's free tier, so any deployment has it. */
export const titleModel = "openai/gpt-4.1-nano";

const CATALOG = "https://ai-gateway.vercel.sh/v1/models";
const REFRESH = 60 * 60 * 1000;
const RETRY = 60 * 1000;

let catalog: Model[] | undefined;
let expires = 0;
let refreshing: Promise<Model[]> | undefined;

/** Refreshed hourly per server; the last catalog serves while a new one loads or fails. */
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

  const entries: { model: Model; released: number }[] = [];
  for (const raw of data) {
    // Entries are parsed one by one, so a shape the app doesn't know is skipped.
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) continue;
    const { id, name, type, owned_by, released, tags } = entry.data;
    if (type !== "language" || !tags?.includes("tool-use")) continue;
    if (allowed && !allowed.includes(id)) continue;
    const model: Model = {
      id,
      name,
      provider: owned_by,
      efforts: effortsOf(entry.data.reasoning_options),
    };
    if (id === TOAST_MODEL) model.toast = true;
    entries.push({ model, released: released ?? 0 });
  }

  // Toast first, then by provider, newest first.
  entries.sort(
    (a, b) =>
      (b.model.toast ? 1 : 0) - (a.model.toast ? 1 : 0) ||
      a.model.provider.localeCompare(b.model.provider) ||
      b.released - a.released,
  );
  return entries.map(({ model }) => model);
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
