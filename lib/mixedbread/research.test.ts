import assert from "node:assert/strict";
import { test } from "node:test";
import type { Mixedbread } from "@mixedbread/sdk";
import {
  type ResearchEvent,
  type ResearchTarget,
  research,
} from "./research.ts";

function streaming(chunks: unknown[], requests: unknown[] = []): Mixedbread {
  let body = "";
  for (const chunk of chunks) body += `data: ${JSON.stringify(chunk)}\n\n`;
  body += "data: [DONE]\n\n";
  const response = async () => new Response(body);
  return {
    chat: {
      createCompletion(request: unknown) {
        requests.push(request);
        return { asResponse: response };
      },
    },
  } as unknown as Mixedbread;
}

async function collect(
  client: Mixedbread,
  target: ResearchTarget = { kind: "stores", stores: "auto" },
): Promise<ResearchEvent[]> {
  const events: ResearchEvent[] = [];
  const turns = [{ role: "user" as const, content: "q" }];
  for await (const event of research(client, turns, target)) {
    events.push(event);
  }
  return events;
}

test("normalizes steps, skips unknown shapes, and cites what Toast read", async () => {
  const events = await collect(
    streaming([
      {
        choices: [],
        hosted_tool_calls: [
          {
            id: "1",
            type: "search_corpus_call",
            status: "completed",
            queries: ["leave"],
            store: "mixedbread/web",
            results: [
              {
                chunk_id: "f:3",
                file_title: "Leave policy",
                mime_type: "image/jpeg",
                text: "Leave policy\n\n[truncated: chunk payload shortened]…take 30 days…[truncated: chunk payload shortened]a year.",
              },
              { chunk_id: "b", ocr_text: `${"word ".repeat(150)}end` },
            ],
          },
          { id: "2", type: "rerank_call", status: "in_progress" },
          { id: "3", status: "completed" },
        ],
      },
      {
        choices: [
          {
            delta: {
              content: "30 days.",
              annotations: [
                {
                  type: "file_citation",
                  file_id: "f",
                  filename: "hr.pdf",
                  index: 0,
                  chunk_id: "f:3",
                  store_id: "s",
                },
                {
                  type: "url_citation",
                  url: "https://example.com",
                  title: "Example",
                  start_index: 3,
                  chunk_id: "b",
                },
                { type: "image_citation", chunk_id: "x" },
              ],
            },
            finish_reason: "stop",
          },
        ],
      },
    ]),
  );
  assert.deepEqual(events, [
    {
      type: "step",
      step: {
        id: "1",
        kind: "search",
        status: "done",
        queries: ["leave"],
        results: 2,
      },
      chunks: ["f:3", "b"],
    },
    {
      type: "step",
      step: { id: "2", kind: "other", status: "running", tool: "rerank_call" },
      chunks: [],
    },
    {
      type: "answer",
      text: "30 days.",
      citations: [
        {
          type: "file",
          at: 0,
          fileId: "f",
          filename: "hr.pdf",
          chunkId: "f:3",
          chunkIndex: 3,
          storeId: "s",
          image: true,
          excerpt: "…take 30 days…a year.",
        },
        {
          type: "url",
          at: 3,
          url: "https://example.com",
          title: "Example",
          excerpt: `${"word ".repeat(119)}word…`,
        },
      ],
    },
  ]);
});

test("on auto Toast lists the stores and picks per step; picks go as they are", async () => {
  const requests: {
    tools: { type: string; store_identifiers?: string[] }[];
  }[] = [];
  const client = streaming(
    [{ choices: [{ delta: {}, finish_reason: "stop" }] }],
    requests,
  );
  await collect(client, { kind: "stores", stores: "auto" });
  await collect(client, { kind: "stores", stores: ["store-1"] });
  const [auto, picked] = requests;
  assert.deepEqual(auto.tools.at(-1), { type: "list_stores" });
  assert.equal(auto.tools[0].store_identifiers, undefined);
  assert.deepEqual(picked.tools[0].store_identifiers, ["store-1"]);
  assert.ok(!picked.tools.some((tool) => tool.type === "list_stores"));
});

test("a stream that ends before the answer finishes fails", async () => {
  await assert.rejects(
    collect(streaming([{ choices: [{ delta: { content: "30" } }] }])),
    /ended before the answer finished/,
  );
});
