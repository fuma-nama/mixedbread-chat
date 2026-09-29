import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Set to answer every request with a local Ollama model instead of AI
 * Gateway, whatever the picker says, e.g. `qwen3.5:9b` for testing without a
 * Gateway key.
 */
const ollamaModel = process.env.OLLAMA_MODEL;

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
});

/** The model that answers for a model ID from `lib/models.ts`. */
export function languageModel(id: string): LanguageModel {
  return ollamaModel ? ollama(ollamaModel) : id;
}
