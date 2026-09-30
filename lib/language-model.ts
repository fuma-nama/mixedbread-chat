import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/** With `OLLAMA_MODEL` set, a local Ollama model answers every request, to test without AI Gateway. */
const ollama =
  process.env.OLLAMA_MODEL &&
  createOpenAICompatible({
    name: "ollama",
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  })(process.env.OLLAMA_MODEL);

export function languageModel(id: string): LanguageModel {
  return ollama || id;
}
