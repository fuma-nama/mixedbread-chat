import assert from "node:assert/strict";
import { test } from "node:test";
import type { SourceSelection } from "../sources.ts";
import type { Citation } from "./research.ts";
import { combine, merge, planRuns, type RunResult } from "./runs.ts";

const connections = [
  { organizationId: "org-a", accountId: "acc-a", name: "Organization 1" },
  { organizationId: "org-b", accountId: "acc-b", name: "Organization 2" },
];

function labels() {
  let next = 1;
  return () => `S${next++}`;
}

test("an organization missing from the selection searches every store", () => {
  const selection: SourceSelection = { web: true, organizations: {} };
  const runs = planRuns(selection, connections);
  assert.deepEqual(
    runs.map((run) => [run.label, run.target]),
    [
      ["Organization 1", { kind: "stores", stores: "all" }],
      ["Organization 2", { kind: "stores", stores: "all" }],
      ["Web", { kind: "web" }],
    ],
  );
});

test("organizations with no stores picked are skipped, and the web borrows a picked one's token", () => {
  const selection: SourceSelection = {
    web: true,
    organizations: { "org-a": [], "org-b": ["store-1"] },
  };
  const runs = planRuns(selection, connections);
  assert.deepEqual(
    runs.map((run) => [run.label, run.connection.accountId]),
    [
      ["Organization 2", "acc-b"],
      ["Web", "acc-b"],
    ],
  );
});

test("nothing picked means no runs", () => {
  const selection: SourceSelection = {
    web: false,
    organizations: { "org-a": [], "org-b": [] },
  };
  assert.deepEqual(planRuns(selection, connections), []);
});

test("citations are labelled across runs in order, and files learn their store", () => {
  const file: Citation = {
    type: "file",
    at: 5,
    fileId: "file-1",
    filename: "handbook.pdf",
    chunkId: "file-1:0",
    storeId: "store-1",
  };
  const web: Citation = {
    type: "url",
    at: 3,
    url: "https://example.com",
    title: "Example",
  };
  const results: RunResult[] = [
    {
      status: "done",
      text: "Leave is 30 days.",
      citations: [file],
      storeNames: new Map([["store-1", "HR"]]),
    },
    {
      status: "done",
      text: "It is sunny.",
      citations: [web],
      storeNames: new Map(),
    },
  ];
  const { findings, sources } = combine(
    [{ label: "Organization 1" }, { label: "Web" }],
    results,
    labels(),
  );
  assert.equal(
    findings,
    "### Organization 1\n\nLeave[S1] is 30 days.\n\n### Web\n\nIt [S2]is sunny.",
  );
  assert.deepEqual(
    sources.map((source) => [
      source.label,
      source.type === "file" ? source.storeName : source.url,
    ]),
    [
      ["S1", "HR"],
      ["S2", "https://example.com"],
    ],
  );
});

test("a failed run says so, and a single run gets no heading", () => {
  const failed = combine(
    [{ label: "Web" }],
    [{ status: "failed", message: "Mixedbread could not be reached." }],
    labels(),
  );
  assert.equal(
    failed.findings,
    "The search failed: Mixedbread could not be reached.",
  );
  assert.deepEqual(failed.sources, []);
});

test("merge yields values from every generator as they come", async () => {
  async function* slow() {
    await new Promise((resolve) => setTimeout(resolve, 20));
    yield "slow";
  }
  async function* fast() {
    yield "fast 1";
    yield "fast 2";
  }
  const seen: string[] = [];
  for await (const { index, value } of merge([slow(), fast()])) {
    seen.push(`${index}:${value}`);
  }
  assert.deepEqual(seen, ["1:fast 1", "1:fast 2", "0:slow"]);
});
