import {
  generateId,
  type LanguageModel,
  simulateStreamingMiddleware,
  wrapLanguageModel,
} from "ai";

type Message = Parameters<
  Extract<LanguageModel, { specificationVersion: "v4" }>["doGenerate"]
>[0]["prompt"][number];

const usage = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};

// Hands the question to the search tool, then answers with its findings, so
// the chat stays plain tool calls any model can pick up afterwards.
export const toastModel = wrapLanguageModel({
  model: {
    specificationVersion: "v4",
    provider: "mixedbread",
    modelId: "toast-1",
    supportedUrls: {},
    async doGenerate({ prompt, tools }) {
      const last = prompt.at(-1);
      if (
        last?.role === "user" &&
        tools?.some(({ name }) => name === "search")
      ) {
        let query = "";
        for (const part of last.content)
          if (part.type === "text") query += part.text;
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: generateId(),
              toolName: "search",
              input: JSON.stringify({ query }),
            },
          ],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
          warnings: [],
        };
      }
      return {
        content: [{ type: "text", text: answerOf(last) }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
    doStream() {
      throw new Error("Toast streams through its middleware.");
    },
  },
  middleware: simulateStreamingMiddleware(),
});

function answerOf(message: Message | undefined): string {
  if (message?.role !== "tool") {
    return "Toast answers from what it searches. Pick a source in the sources menu to ask it.";
  }
  for (const part of message.content) {
    if (part.type !== "tool-result") continue;
    const { output } = part;
    // Labels become the links the chat renders as citations.
    if (output.type === "text") {
      return output.value.replace(/\[(S\d+)\](?!\()/g, "[$1](#$1)");
    }
    // The AI SDK passes on a thrown error as "Error: message".
    if (output.type === "error-text")
      return output.value.replace(/^\w*Error: /, "");
  }
  return "Mixedbread could not complete the search.";
}
