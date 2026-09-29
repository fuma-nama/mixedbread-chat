import assert from "node:assert/strict";
import { test } from "node:test";
import { isStepCount, streamText, tool } from "ai";
import { z } from "zod";
import { toastModel } from "./toast-model.ts";

function ask(execute: (input: { query: string }) => Promise<string>) {
  return streamText({
    model: toastModel,
    messages: [{ role: "user", content: "How long is leave?" }],
    tools: {
      search: tool({
        inputSchema: z.object({ query: z.string() }),
        execute,
        toModelOutput: ({ output }) => ({ type: "text", value: output }),
      }),
    },
    stopWhen: isStepCount(8),
  }).text;
}

test("hands the question to search, then answers with its findings", async () => {
  let asked = "";
  const answer = await ask(async ({ query }) => {
    asked = query;
    return "Leave is 30 days[S1], or 40[S2](#S2).";
  });
  assert.equal(asked, "How long is leave?");
  assert.equal(answer, "Leave is 30 days[S1](#S1), or 40[S2](#S2).");
});

test("a failed search answers with why", async () => {
  const answer = await ask(async () => {
    throw new Error("Organization 1 needs to be connected again.");
  });
  assert.equal(answer, "Organization 1 needs to be connected again.");
});

test("with search off, it says how to ask", async () => {
  const answer = await streamText({ model: toastModel, prompt: "Hi" }).text;
  assert.match(answer, /Pick a source/);
});
