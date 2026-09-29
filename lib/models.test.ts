import assert from "node:assert/strict";
import { test } from "node:test";
import { listModels } from "./models.ts";

test("lists tool-calling language models, featured first, with the efforts they take", async () => {
  const language = { type: "language", tags: ["tool-use"] };
  globalThis.fetch = async () =>
    Response.json({
      data: [
        {
          ...language,
          id: "mixedbread/toast-1",
          name: "Toast 1",
          owned_by: "mixedbread",
        },
        {
          ...language,
          id: "zai/glm-5",
          name: "GLM 5",
          owned_by: "zai",
          released: 1,
          reasoning_options: [{ type: "toggle" }, { type: "budget_tokens" }],
        },
        {
          ...language,
          id: "zai/glm-6",
          name: "GLM 6",
          owned_by: "zai",
          released: 2,
        },
        {
          ...language,
          id: "anthropic/claude-sonnet-5",
          name: "Claude Sonnet 5",
          owned_by: "anthropic",
          reasoning_options: [
            { type: "effort", values: ["none", "low", "high", "xhigh", "max"] },
          ],
        },
        {
          ...language,
          id: "anthropic/claude-fable-5.1",
          name: "Claude Fable 5.1",
          owned_by: "anthropic",
        },
        {
          ...language,
          id: "acme/embed",
          name: "Embed",
          owned_by: "acme",
          type: "embedding",
        },
        {
          ...language,
          id: "acme/chat",
          name: "Chat",
          owned_by: "acme",
          tags: [],
        },
        { id: 42 },
      ],
    });

  assert.deepEqual(await listModels(), [
    {
      id: "mixedbread/toast-1",
      name: "Toast 1",
      provider: "Mixedbread",
      featured: true,
      efforts: [],
      toast: true,
    },
    {
      id: "anthropic/claude-fable-5.1",
      name: "Claude Fable 5.1",
      provider: "Anthropic",
      featured: true,
      efforts: [],
    },
    {
      id: "anthropic/claude-sonnet-5",
      name: "Claude Sonnet 5",
      provider: "Anthropic",
      featured: true,
      efforts: ["none", "low", "high", "xhigh"],
    },
    {
      id: "zai/glm-6",
      name: "GLM 6",
      provider: "zai",
      featured: false,
      efforts: [],
    },
    {
      id: "zai/glm-5",
      name: "GLM 5",
      provider: "zai",
      featured: false,
      efforts: ["none"],
    },
  ]);
});
