/**
 * The models people can pick, from https://vercel.com/ai-gateway/models.
 * Each must call tools, for search. The picker groups them by provider, in
 * this order.
 */
export const models = [
  {
    id: "anthropic/claude-fable-5.1",
    name: "Claude Fable 5.1",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-opus-5.5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "Anthropic",
  },
  { id: "openai/gpt-6-sol", name: "GPT-6 Sol", provider: "OpenAI" },
  { id: "openai/gpt-6-luna", name: "GPT-6 Luna", provider: "OpenAI" },
  { id: "openai/gpt-5.6-terra", name: "GPT-5.6 Terra", provider: "OpenAI" },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
  },
  { id: "spacexai/grok-4.7", name: "Grok 4.7", provider: "xAI" },
  { id: "meta/muse-spark-1.3", name: "Muse Spark 1.3", provider: "Meta" },
  {
    id: "mistral/mistral-medium-3.5",
    name: "Mistral Medium 3.5",
    provider: "Mistral",
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
  },
  { id: "moonshotai/kimi-k3", name: "Kimi K3", provider: "Moonshot AI" },
  { id: "alibaba/qwen3.8-max", name: "Qwen 3.8 Max", provider: "Alibaba" },
] as const;

export type ModelId = (typeof models)[number]["id"];

export const defaultModel: ModelId = "anthropic/claude-sonnet-5";

/** Names chats; a small, fast model is enough. */
export const titleModel = "openai/gpt-5.6-luna";

export function isModelId(id: unknown): id is ModelId {
  return models.some((model) => model.id === id);
}
