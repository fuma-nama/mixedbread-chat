import assert from "node:assert/strict";
import { test } from "node:test";
import {
  choiceFor,
  parseSelection,
  type SourceSelection,
  searchesStores,
  serializeSelection,
} from "./sources.ts";

test("an organization missing from the selection is on auto", () => {
  const selection: SourceSelection = {
    web: true,
    organizations: { "org-a": "all" },
  };
  assert.equal(choiceFor(selection, "org-a"), "all");
  assert.equal(choiceFor(selection, "org-b"), "auto");
});

test("auto, all and any picks search stores; no picks don't", () => {
  assert.equal(searchesStores("auto"), true);
  assert.equal(searchesStores("all"), true);
  assert.equal(searchesStores(["store-1"]), true);
  assert.equal(searchesStores([]), false);
});

test("a saved selection keeps each choice, and anything else is the default", () => {
  const selection: SourceSelection = {
    web: false,
    organizations: { "org-a": "auto", "org-b": "all", "org-c": ["store-1"] },
  };
  assert.deepEqual(parseSelection(serializeSelection(selection)), selection);
  const fallback = { web: true, organizations: {} };
  assert.deepEqual(parseSelection(), fallback);
  assert.deepEqual(
    parseSelection(
      serializeSelection({
        web: false,
        organizations: { "org-a": "some" as never },
      }),
    ),
    fallback,
  );
});
