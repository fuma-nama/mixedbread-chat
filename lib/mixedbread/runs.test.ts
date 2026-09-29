import assert from "node:assert/strict";
import { test } from "node:test";
import type { SourceSelection } from "../sources.ts";
import type { Citation } from "./research.ts";
import {
  combine,
  merge,
  planRuns,
  resolveTarget,
  type RunResult,
} from "./runs.ts";

const connections = [
  { organizationId: "org-a", accountId: "acc-a", name: "Organization 1" },
  { organizationId: "org-b", accountId: "acc-b", name: "Organization 2" },
];

function labels() {
  let next = 1;
  return () => `S${next++}`;
}

test("an organization missing from the selection is on auto", () => {
  const selection: SourceSelection = { web: true, organizations: {} };
  const runs = planRuns(selection, connections);
  assert.deepEqual(
    runs.map((run) => [run.label, run.target]),
    [
      ["Organization 1", { kind: "stores", stores: "auto" }],
      ["Organization 2", { kind: "stores", stores: "auto" }],
      ["Web", { kind: "web" }],
    ],
  );
});

test("each organization's choice passes through to its run", () => {
  const selection: SourceSelection = {
    web: false,
    organizations: { "org-a": "all", "org-b": ["store-1"] },
  };
  assert.deepEqual(
    planRuns(selection, connections).map((run) => run.target),
    [
      { kind: "stores", stores: "all" },
      { kind: "stores", stores: ["store-1"] },
    ],
  );
});

test("a run resolves its stores once they are listed", () => {
  const [run] = planRuns({ web: false, organizations: {} }, connections);
  const listed = new Map([
    ["store-1", "HR"],
    ["store-2", "Legal"],
  ]);
  const on = (stores: SourceSelection["organizations"][string]) => ({
    ...run,
    target: { kind: "stores" as const, stores },
  });

  // Auto leaves the pick to Toast, listed or not.
  assert.deepEqual(resolveTarget(on("auto"), undefined), {
    kind: "stores",
    stores: "auto",
  });
  // "all" is every store there is now, stores made since the pick included.
  assert.deepEqual(resolveTarget(on("all"), listed), {
    kind: "stores",
    stores: ["store-1", "store-2"],
  });
  // Without a listing, or with nothing in it, "all" can't search.
  const none = { error: "No stores to search in Organization 1." };
  assert.deepEqual(resolveTarget(on("all"), undefined), none);
  assert.deepEqual(resolveTarget(on("all"), new Map()), none);
  // Picks drop stores deleted since; with all of them gone, the run fails.
  assert.deepEqual(resolveTarget(on(["store-2", "gone"]), listed), {
    kind: "stores",
    stores: ["store-2"],
  });
  assert.deepEqual(resolveTarget(on(["gone"]), listed), {
    error: "The stores picked in Organization 1 no longer exist.",
  });
  // A failed listing keeps the picks as they are.
  assert.deepEqual(resolveTarget(on(["gone"]), undefined), {
    kind: "stores",
    stores: ["gone"],
  });
  assert.deepEqual(
    resolveTarget({ ...run, target: { kind: "web" } }, undefined),
    { kind: "web" },
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
    chunkIndex: 0,
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
  const runs = planRuns({ web: true, organizations: {} }, [connections[0]]);
  const { findings, sources } = combine(runs, results, labels());
  assert.equal(
    findings,
    "### Organization 1\n\nLeave[S1] is 30 days.\n\n### Web\n\nIt [S2]is sunny.",
  );
  assert.deepEqual(
    sources.map((source) =>
      source.type === "file"
        ? [source.label, source.storeName, source.organizationId]
        : [source.label, source.url],
    ),
    [
      ["S1", "HR", "org-a"],
      ["S2", "https://example.com"],
    ],
  );
});

test("a failed run says so, and a single run gets no heading", () => {
  const failed = combine(
    planRuns({ web: true, organizations: { "org-a": [] } }, [connections[0]]),
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
