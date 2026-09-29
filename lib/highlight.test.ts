import assert from "node:assert/strict";
import { test } from "node:test";
import { highlight } from "./highlight.ts";

const page = [
  { text: "2 . BACKGROUND" },
  { text: "Embeddings and similarity" },
  {
    text: "An embedding model is a function that maps an input (a sentence, a page image, a clip of audio) to a vector.",
  },
  {
    text: "Training is contrastive. Take a batch of matching (query, document) pairs; each query must pick its own document.",
  },
];

test("marks the block a claim quotes or paraphrases", () => {
  assert.deepEqual(
    highlight(
      "An embedding model maps a sentence or page image to a vector",
      page,
    ),
    [2],
  );
  assert.deepEqual(
    highlight(
      "Training is contrastive, over batches of query and document pairs",
      page,
    ),
    [3],
  );
});

test("marks nothing for a claim the page doesn't hold", () => {
  assert.deepEqual(highlight("Leave is thirty days a year", page), []);
  assert.deepEqual(highlight("Audio models were made in Berlin", page), []);
  assert.deepEqual(highlight("", page), []);
});
