import { generateId, type LanguageModel } from "ai";

type ModelV4 = Extract<LanguageModel, { specificationVersion: "v4" }>;
type Part =
  Awaited<ReturnType<ModelV4["doStream"]>>["stream"] extends ReadableStream<
    infer P
  >
    ? P
    : never;
type Message = Parameters<ModelV4["doStream"]>[0]["prompt"][number];

const usage = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};

/**
 * The chat model when Toast answers: it hands the question to the search
 * tool, where Toast reads the conversation and searches, then replies with
 * Toast's findings. The chat stays one of plain tool calls, so any model can
 * pick it up afterwards.
 */
export const toastModel: ModelV4 = {
  specificationVersion: "v4",
  provider: "mixedbread",
  modelId: "toast-1",
  supportedUrls: {},
  doGenerate() {
    throw new Error("Toast answers by streaming.");
  },
  async doStream({ prompt, tools }) {
    const last = prompt.at(-1);
    const parts: Part[] = [{ type: "stream-start", warnings: [] }];
    if (last?.role === "user" && tools?.some(({ name }) => name === "search")) {
      parts.push(
        {
          type: "tool-call",
          toolCallId: generateId(),
          toolName: "search",
          input: JSON.stringify({ query: textOf(last) }),
        },
        {
          type: "finish",
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
        },
      );
    } else {
      const id = generateId();
      parts.push(
        { type: "text-start", id },
        { type: "text-delta", id, delta: answerOf(last) },
        { type: "text-end", id },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: undefined },
          usage,
        },
      );
    }
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      }),
    };
  },
};

function textOf(message: Message): string {
  let text = "";
  if (message.role === "user") {
    for (const part of message.content) {
      if (part.type === "text") text += part.text;
    }
  }
  return text;
}

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
