import assert from "node:assert/strict";
import { test } from "node:test";
import type { SourceSelection } from "../sources.ts";
import type { Citation } from "./citations.ts";
import {
  combine,
  merge,
  planRuns,
  resolveTarget,
  type RunResult,
} from "./runs.ts";

const connections = [
  {
    organizationId: "org-a",
    accountId: "acc-a",
    name: "Organization 1",
    expiresAt: null,
  },
  {
    organizationId: "org-b",
    accountId: "acc-b",
    name: "Organization 2",
    expiresAt: null,
  },
];

function labels() {
  let next = 1;
  return () => `S${next++}`;
}

test("plans a run per organization with stores picked, and the web on one's token", () => {
  const plan = (selection: SourceSelection) =>
    planRuns(selection, connections).map((run) => [
      run.label,
      run.connection.accountId,
      run.target,
    ]);
  // A missing organization is on auto.
  assert.deepEqual(plan({ web: true, organizations: {} }), [
    ["Organization 1", "acc-a", { kind: "stores", stores: "auto" }],
    ["Organization 2", "acc-b", { kind: "stores", stores: "auto" }],
    ["Web", "acc-a", { kind: "web" }],
  ]);
  assert.deepEqual(
    plan({ web: true, organizations: { "org-a": [], "org-b": ["store-1"] } }),
    [
      ["Organization 2", "acc-b", { kind: "stores", stores: ["store-1"] }],
      ["Web", "acc-b", { kind: "web" }],
    ],
  );
  assert.deepEqual(
    plan({ web: false, organizations: { "org-a": "all", "org-b": [] } }),
    [["Organization 1", "acc-a", { kind: "stores", stores: "all" }]],
  );
  assert.deepEqual(
    plan({ web: false, organizations: { "org-a": [], "org-b": [] } }),
    [],
  );
});

test("a run resolves its stores once they are listed", async () => {
  const [run] = planRuns({ web: false, organizations: {} }, connections);
  const listed = Promise.resolve(
    new Map([
      ["store-1", "HR"],
      ["store-2", "Legal"],
    ]),
  );
  const failed = Promise.resolve(undefined);
  const on = (stores: SourceSelection["organizations"][string]) => ({
    ...run,
    target: { kind: "stores" as const, stores },
  });

  // Auto leaves the pick to Toast, without waiting for the listing.
  const listing = new Promise<undefined>(() => {});
  assert.deepEqual(await resolveTarget(on("auto"), listing), {
    kind: "stores",
    stores: "auto",
  });
  // "all" is every store there is now, stores made since the pick included,
  // by name as a question would say it.
  assert.deepEqual(await resolveTarget(on("all"), listed), {
    kind: "stores",
    stores: ["HR", "Legal"],
  });
  // Without a listing, or with nothing in it, "all" can't search.
  const none = { error: "No stores to search in Organization 1." };
  assert.deepEqual(await resolveTarget(on("all"), failed), none);
  assert.deepEqual(
    await resolveTarget(on("all"), Promise.resolve(new Map())),
    none,
  );
  // Picks drop stores deleted since; with all of them gone, the run fails.
  assert.deepEqual(await resolveTarget(on(["store-2", "gone"]), listed), {
    kind: "stores",
    stores: ["Legal"],
  });
  assert.deepEqual(await resolveTarget(on(["gone"]), listed), {
    error: "The stores picked in Organization 1 no longer exist.",
  });
  // A failed listing keeps the picks as they are.
  assert.deepEqual(await resolveTarget(on(["gone"]), failed), {
    kind: "stores",
    stores: ["gone"],
  });
  assert.deepEqual(
    await resolveTarget({ ...run, target: { kind: "web" } }, undefined),
    { kind: "web" },
  );
});

test("citations are labelled across runs in order", () => {
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
    { type: "answer", text: "Leave is 30 days.", citations: [file] },
    { type: "answer", text: "It is sunny.", citations: [web] },
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
        ? [source.label, source.chunkId]
        : [source.label, source.url],
    ),
    [
      ["S1", "file-1:0"],
      ["S2", "https://example.com"],
    ],
  );
});

test("a failed run says so, and a single run gets no heading", () => {
  const failed = combine(
    planRuns({ web: true, organizations: { "org-a": [] } }, [connections[0]]),
    [{ type: "failed", message: "Mixedbread could not be reached." }],
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
