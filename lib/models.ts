/** The models people can pick, from https://vercel.com/ai-gateway/models. */
export const models = [
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
  { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5" },
  { id: "openai/gpt-5.6-terra", name: "GPT-5.6 Terra" },
  { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
] as const;

export type ModelId = (typeof models)[number]["id"];

export const defaultModel: ModelId = "anthropic/claude-sonnet-5";

/** Names chats; a small, fast model is enough. */
export const titleModel = "openai/gpt-5.6-luna";

export function isModelId(id: unknown): id is ModelId {
  return models.some((model) => model.id === id);
}
