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
  target: ResearchTarget = { kind: "stores", stores: ["store-1"] },
): Promise<ResearchEvent[]> {
  const events: ResearchEvent[] = [];
  for await (const event of research(client, "q", target)) {
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

test("every Toast tool is pinned to the stores given, and the query is one turn", async () => {
  const requests: {
    messages: unknown[];
    tools: { type: string; store_identifiers?: string[] }[];
  }[] = [];
  const client = streaming(
    [{ choices: [{ delta: {}, finish_reason: "stop" }] }],
    requests,
  );
  await collect(client, { kind: "stores", stores: ["store-1", "store-2"] });
  await collect(client, { kind: "web" });
  const [stores, web] = requests;
  for (const tool of stores.tools) {
    assert.deepEqual(tool.store_identifiers, ["store-1", "store-2"]);
  }
  assert.deepEqual(web.tools, [
    {
      type: "search_corpus",
      store_identifiers: ["mixedbread/web"],
      citations: true,
    },
  ]);
  assert.deepEqual(stores.messages.slice(1), [{ role: "user", content: "q" }]);
});

test("a stream that ends before the answer finishes fails", async () => {
  await assert.rejects(
    collect(streaming([{ choices: [{ delta: { content: "30" } }] }])),
    /ended before the answer finished/,
  );
});
