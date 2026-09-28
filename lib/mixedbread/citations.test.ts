import assert from "node:assert/strict";
import { test } from "node:test";
import { type Annotation, labelCitations } from "./citations.ts";

function labels() {
  let next = 1;
  return () => `S${next++}`;
}

test("marks every citation and labels each cited page or chunk once", () => {
  const annotations: Annotation[] = [
    {
      type: "url_citation",
      url: "https://example.com",
      title: "Example",
      start_index: 5,
      end_index: 5,
      chunk_id: "web:0",
    },
    {
      type: "file_citation",
      file_id: "file",
      filename: "report.pdf",
      index: 11,
      chunk_id: "file:2",
      store_id: "store",
    },
    {
      type: "url_citation",
      url: "https://example.com",
      title: "Example",
      start_index: 11,
      end_index: 11,
      chunk_id: "web:1",
    },
  ];

  const { text, sources } = labelCitations(
    "First. Then.",
    annotations,
    labels(),
  );

  assert.equal(text, "First[S1]. Then[S2][S1].");
  assert.deepEqual(sources, [
    { label: "S1", type: "url", url: "https://example.com", title: "Example" },
    {
      label: "S2",
      type: "file",
      fileId: "file",
      filename: "report.pdf",
      chunkId: "file:2",
      storeId: "store",
    },
  ]);
});

test("counts offsets in code points", () => {
  const { text } = labelCitations(
    "👋 hi",
    [
      {
        type: "url_citation",
        url: "https://example.com",
        title: "Example",
        start_index: 4,
        end_index: 4,
        chunk_id: "web:0",
      },
    ],
    labels(),
  );

  assert.equal(text, "👋 hi[S1]");
});
