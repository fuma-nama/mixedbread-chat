import type { Mixedbread } from "@mixedbread/sdk";
import {
  choiceFor,
  type Organization,
  type SourceSelection,
  searchesStores,
} from "../sources.ts";
import { labelCitations, type Source } from "./citations.ts";
import type { Connection } from "./organizations.ts";
import type { ResearchEvent, ResearchTarget } from "./research.ts";

export interface Run {
  label: string;
  /** Whose token the run uses; the web run borrows one, which it bills. */
  connection: Connection;
  target: { kind: "web" } | { kind: "stores"; stores: "all" | string[] };
}

export interface FoundStores {
  organization: Organization;
  stores?: { id: string; name: string; description?: string | null }[];
  error?: string;
}

/**
 * Up to 20 stores of each organization on auto whose name or description
 * holds `query`, or else its newest.
 */
export function findStores(
  selection: SourceSelection,
  connections: Connection[],
  clientOf: (connection: Connection) => Promise<Mixedbread>,
  query: string,
): Promise<FoundStores[]> {
  async function storesOf(connection: Connection): Promise<FoundStores> {
    const organization = {
      id: connection.organizationId,
      name: connection.name,
    };
    try {
      const client = await clientOf(connection);
      const list = async (q?: string) =>
        (await client.stores.list({ q, limit: 20 })).data;
      // Questions rarely name a store, and the API turns down an empty query.
      let data = query ? await list(query) : [];
      if (data.length === 0) data = await list();
      const stores = data.map(({ id, name, description }) => ({
        id,
        name,
        description,
      }));
      return { organization, stores };
    } catch {
      return { organization, error: "Mixedbread could not list its stores." };
    }
  }
  const found: Promise<FoundStores>[] = [];
  for (const connection of connections) {
    if (choiceFor(selection, connection.organizationId) === "auto") {
      found.push(storesOf(connection));
    }
  }
  return Promise.all(found);
}

/** On auto, an organization searches the stores the chat model picked from `findStores`. */
export function planRuns(
  selection: SourceSelection,
  connections: Connection[],
  picks: { organization: string; ids: string[] }[] = [],
): Run[] {
  const runs: Run[] = [];
  for (const connection of connections) {
    const { organizationId } = connection;
    let choice = choiceFor(selection, organizationId);
    if (choice === "auto") {
      choice =
        picks.find((pick) => pick.organization === organizationId)?.ids ?? [];
    }
    if (!searchesStores(choice)) continue;
    runs.push({
      label: connection.name,
      connection,
      target: { kind: "stores", stores: choice },
    });
  }
  const payer = runs[0]?.connection ?? connections[0];
  if (selection.web && payer) {
    runs.push({ label: "Web", connection: payer, target: { kind: "web" } });
  }
  return runs;
}

/**
 * Picks drop stores deleted since, as one fails the whole run. A failed
 * listing resolves undefined.
 */
export async function resolveTarget(
  { label, target }: Run,
  listing: Promise<ReadonlyMap<string, string> | undefined> | undefined,
): Promise<ResearchTarget | { error: string }> {
  if (target.kind === "web") return target;
  const { stores } = target;
  const listed = await listing;
  if (stores === "all") {
    return listed?.size
      ? { kind: "stores", stores: Array.from(listed.keys()) }
      : { error: `No stores to search in ${label}.` };
  }
  if (!listed) return { kind: "stores", stores };
  const kept = stores.filter((id) => listed.has(id));
  return kept.length > 0
    ? { kind: "stores", stores: kept }
    : { error: `The stores picked in ${label} no longer exist.` };
}

export type RunEvent = ResearchEvent | { type: "failed"; message: string };

export type RunResult = Exclude<RunEvent, { type: "step" }>;

export function combine(
  runs: Run[],
  results: RunResult[],
  nextLabel: () => string,
): { findings: string; sources: Source[] } {
  const sections: string[] = [];
  const sources: Source[] = [];
  runs.forEach((run, index) => {
    const result = results[index];
    let text: string;
    if (result.type === "failed") text = `The search failed: ${result.message}`;
    else {
      const labelled = labelCitations(result.text, result.citations, nextLabel);
      text = labelled.text.trim() || "Nothing relevant found.";
      sources.push(...labelled.sources);
    }
    sections.push(runs.length > 1 ? `### ${run.label}\n\n${text}` : text);
  });
  return { findings: sections.join("\n\n"), sources };
}

/** Runs `generators` side by side; one that throws stops them all. */
export async function* merge<T>(
  generators: AsyncGenerator<T>[],
): AsyncGenerator<{ index: number; value: T }> {
  const next = (index: number) =>
    generators[index].next().then((result) => ({ index, result }));
  const pending = new Map(generators.map((_, index) => [index, next(index)]));
  try {
    while (pending.size > 0) {
      const { index, result } = await Promise.race(pending.values());
      if (result.done) {
        pending.delete(index);
        continue;
      }
      pending.set(index, next(index));
      yield { index, value: result.value };
    }
  } finally {
    // Stopped early, as on an abort: let the others clean up.
    for (const index of pending.keys())
      void generators[index].return(undefined);
  }
}
