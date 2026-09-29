import assert from "node:assert/strict";
import { test } from "node:test";
import { labelCitations } from "./citations.ts";
import type { Citation } from "./research.ts";

function labels() {
  let next = 1;
  return () => `S${next++}`;
}

test("marks every citation and labels each cited page or chunk once", () => {
  const citations: Citation[] = [
    {
      type: "url",
      at: 5,
      url: "https://example.com",
      title: "Example",
      excerpt: "First passage",
    },
    {
      type: "file",
      at: 11,
      fileId: "file",
      filename: "report.pdf",
      chunkId: "file:2",
      chunkIndex: 2,
      storeId: "store",
    },
    {
      type: "url",
      at: 11,
      url: "https://example.com",
      title: "Example",
      excerpt: "Second passage",
    },
  ];

  const { text, sources } = labelCitations("First. Then.", citations, labels());

  assert.equal(text, "First[S1]. Then[S2][S1].");
  assert.deepEqual(sources, [
    {
      label: "S1",
      type: "url",
      url: "https://example.com",
      title: "Example",
      excerpt: "First passage",
    },
    {
      label: "S2",
      type: "file",
      fileId: "file",
      filename: "report.pdf",
      chunkId: "file:2",
      chunkIndex: 2,
      storeId: "store",
    },
  ]);
});

test("an image keeps the sentence citing it, to find on its page", () => {
  const text = "Leave is short. Staff get 30 days of paid leave. Next.";
  const { sources } = labelCitations(
    text,
    [
      {
        type: "file",
        at: text.indexOf(" Next"),
        fileId: "file",
        filename: "handbook.pdf",
        chunkId: "file:4",
        chunkIndex: 4,
        storeId: "store",
        image: true,
      },
    ],
    labels(),
  );

  assert.equal(
    sources[0].type === "file" && sources[0].claim,
    "Staff get 30 days of paid leave",
  );
});

test("counts offsets in code points", () => {
  const { text } = labelCitations(
    "👋 hi",
    [{ type: "url", at: 4, url: "https://example.com", title: "Example" }],
    labels(),
  );

  assert.equal(text, "👋 hi[S1]");
});
