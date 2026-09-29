import { z } from "zod";

/** An organization the user connected; each sign-in grants one. */
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

/** Every store of an organization (Toast picks among them), some, or none. */
export type StoreChoice = "all" | string[];

export interface SourceSelection {
  web: boolean;
  /** By organization ID; a missing organization searches every store. */
  organizations: Record<string, StoreChoice>;
}

export const defaultSelection: SourceSelection = {
  web: true,
  organizations: {},
};

export type SearchScope = "web" | "docs" | "both" | "none";

export function choiceFor(
  selection: SourceSelection,
  organizationId: string,
): StoreChoice {
  return selection.organizations[organizationId] ?? "all";
}

export function searchesStores(choice: StoreChoice): boolean {
  return choice === "all" || choice.length > 0;
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

export const sourceSelectionSchema = z.object({
  web: z.boolean(),
  organizations: z.record(
    z.string().max(100),
    // Bounded so the selection cookie stays well under 4 KB.
    z.union([z.literal("all"), z.array(z.string().max(100)).max(60)]),
  ),
});

export const SELECTION_COOKIE = "sources";

export function parseSelection(value: unknown): SourceSelection | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = sourceSelectionSchema.safeParse(
      JSON.parse(decodeURIComponent(value)),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function serializeSelection(selection: SourceSelection): string {
  return encodeURIComponent(JSON.stringify(selection));
}
