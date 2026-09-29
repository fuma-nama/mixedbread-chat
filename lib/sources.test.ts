import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSelection,
  type SourceSelection,
  serializeSelection,
} from "./sources.ts";

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
