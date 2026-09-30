import { z } from "zod";

export interface Organization {
  id: string;
  name: string;
}

export interface StoreOption {
  id: string;
  name: string;
  description: string | null;
  /** Files that finished processing. */
  files: number;
  status: "in_progress" | "completed" | "failed" | "expired";
  /** ISO timestamp. */
  updatedAt: string;
}

export type StoresResult =
  | { status: "ok"; stores: StoreOption[] }
  /** The grant lapsed or lacks access: signing in to it again fixes this. */
  | { status: "reconnect" }
  | { status: "error"; message: string };

// Toast picks among the stores ("auto"), every store there is at search time
// ("all"), or exactly these; none leaves the organization out.
export type StoreChoice = "auto" | "all" | string[];

export interface SourceSelection {
  web: boolean;
  /** By organization ID; a missing organization is on auto. */
  organizations: Record<string, StoreChoice>;
}

export type SearchScope = "web" | "docs" | "both" | "none";

export function choiceFor(
  selection: SourceSelection,
  organizationId: string,
): StoreChoice {
  return selection.organizations[organizationId] ?? "auto";
}

export function searchesStores(choice: StoreChoice): boolean {
  return typeof choice === "string" || choice.length > 0;
}

export function scopeOf(
  selection: SourceSelection,
  organizations: Organization[],
): SearchScope {
  const docs = organizations.some((organization) =>
    searchesStores(choiceFor(selection, organization.id)),
  );
  if (selection.web) return docs ? "both" : "web";
  return docs ? "docs" : "none";
}

/** The stores of an organization the picker lists: the first page. */
export const MAX_STORES = 100;

export const sourceSelectionSchema = z.object({
  web: z.boolean(),
  organizations: z.record(
    z.string().max(100),
    z.union([
      z.literal("auto"),
      z.literal("all"),
      z.array(z.string().max(100)).max(MAX_STORES),
    ]),
  ),
});

export const SELECTION_COOKIE = "sources";

/** The selection the picker's cookie holds; by default, the web and Toast picking stores. */
export function parseSelection(value = ""): SourceSelection {
  try {
    return sourceSelectionSchema.parse(JSON.parse(decodeURIComponent(value)));
  } catch {
    return { web: true, organizations: {} };
  }
}

export function serializeSelection(selection: SourceSelection): string {
  return encodeURIComponent(JSON.stringify(selection));
}
