import * as z from "zod";

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
  /** Signing in to the organization again fixes it. */
  | { status: "reconnect" }
  | { status: "error" };

/** The picker lists only an organization's first page of stores. */
export const MAX_STORES = 100;

export const sourceSelectionSchema = z.object({
  web: z.boolean(),
  // By organization ID; missing is "auto", where Toast picks. "all" is every
  // store at search time, and an empty list leaves the organization out.
  organizations: z.record(
    z.string().max(100),
    z.enum(["auto", "all"]).or(z.array(z.string().max(100)).max(MAX_STORES)),
  ),
});

export type SourceSelection = z.infer<typeof sourceSelectionSchema>;

export type StoreChoice = SourceSelection["organizations"][string];

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

export const SELECTION_COOKIE = "sources";

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
