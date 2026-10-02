import assert from "node:assert/strict";
import { test } from "node:test";
import type { Mixedbread } from "@mixedbread/sdk";
import type { SourceSelection } from "../sources.ts";
import type { Citation } from "./citations.ts";
import {
  combine,
  findStores,
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
  const plan = (
    selection: SourceSelection,
    picks?: { organization: string; ids: string[] }[],
  ) =>
    planRuns(selection, connections, picks).map((run) => [
      run.label,
      run.connection.accountId,
      run.target,
    ]);
  // On auto, an organization searches only the stores the model picked.
  assert.deepEqual(plan({ web: true, organizations: {} }), [
    ["Web", "acc-a", { kind: "web" }],
  ]);
  assert.deepEqual(
    plan({ web: true, organizations: { "org-a": "all" } }, [
      { organization: "org-a", ids: ["store-1"] },
      { organization: "org-b", ids: ["store-2"] },
    ]),
    [
      ["Organization 1", "acc-a", { kind: "stores", stores: "all" }],
      ["Organization 2", "acc-b", { kind: "stores", stores: ["store-2"] }],
      ["Web", "acc-a", { kind: "web" }],
    ],
  );
  assert.deepEqual(
    plan({ web: false, organizations: {} }, [
      { organization: "org-b", ids: [] },
    ]),
    [],
  );
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

test("a run resolves its stores by ID once they are listed", async () => {
  const [run] = planRuns(
    { web: false, organizations: { "org-a": "all" } },
    connections,
  );
  const listed = Promise.resolve(
    new Map([
      ["store-1", "HR"],
      ["store-2", "Legal"],
    ]),
  );
  const failed = Promise.resolve(undefined);
  const on = (stores: "all" | string[]) => ({
    ...run,
    target: { kind: "stores" as const, stores },
  });

  assert.deepEqual(await resolveTarget(on("all"), listed), {
    kind: "stores",
    stores: ["store-1", "store-2"],
  });
  const none = { error: "No stores to search in Organization 1." };
  assert.deepEqual(await resolveTarget(on("all"), failed), none);
  assert.deepEqual(
    await resolveTarget(on("all"), Promise.resolve(new Map())),
    none,
  );
  assert.deepEqual(await resolveTarget(on(["store-2", "gone"]), listed), {
    kind: "stores",
    stores: ["store-2"],
  });
  assert.deepEqual(await resolveTarget(on(["gone"]), listed), {
    error: "The stores picked in Organization 1 no longer exist.",
  });
  assert.deepEqual(await resolveTarget(on(["gone"]), failed), {
    kind: "stores",
    stores: ["gone"],
  });
  assert.deepEqual(
    await resolveTarget({ ...run, target: { kind: "web" } }, undefined),
    { kind: "web" },
  );
});

test("finds matching stores in each organization on auto", async () => {
  const asked: unknown[] = [];
  const clientOf = async ({ organizationId }: { organizationId: string }) => {
    if (organizationId === "org-c") throw new Error("Token expired");
    const stores = {
      list: async (params: { q?: string }) => {
        asked.push(params);
        if (params.q === "tax") return { data: [] };
        return {
          data: [
            { id: "store-1", name: "hr", description: "Policies", extra: 1 },
            { id: "store-2", name: "legal-hr", description: null },
          ],
        };
      },
    };
    return { stores } as unknown as Mixedbread;
  };
  const third = { ...connections[0], organizationId: "org-c", name: "Org 3" };
  const found = await findStores(
    { web: true, organizations: { "org-b": "all" } },
    [...connections, third],
    clientOf,
    "hr",
  );
  assert.deepEqual(asked, [{ q: "hr", limit: 20 }]);
  assert.deepEqual(found, [
    {
      organization: { id: "org-a", name: "Organization 1" },
      stores: [
        { id: "store-1", name: "hr", description: "Policies" },
        { id: "store-2", name: "legal-hr", description: null },
      ],
    },
    {
      organization: { id: "org-c", name: "Org 3" },
      error: "Mixedbread could not list its stores.",
    },
  ]);

  // Without a match, or a query, it lists the newest.
  asked.length = 0;
  const newest = await findStores(
    { web: true, organizations: { "org-b": [] } },
    connections,
    clientOf,
    "tax",
  );
  assert.equal(newest[0].stores?.length, 2);
  await findStores(
    { web: true, organizations: { "org-b": [] } },
    connections,
    clientOf,
    "",
  );
  assert.deepEqual(asked, [
    { q: "tax", limit: 20 },
    { q: undefined, limit: 20 },
    { q: undefined, limit: 20 },
  ]);
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
  const runs = planRuns({ web: true, organizations: { "org-a": "all" } }, [
    connections[0],
  ]);
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
