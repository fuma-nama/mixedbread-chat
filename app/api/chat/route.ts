import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { type ChatMessage, nextLabel, searchTool } from "@/lib/search-tool";

export async function POST(request: Request) {
  const { messages }: { messages: ChatMessage[] } = await request.json();
  const tools = { search: searchTool(nextLabel(messages)) };

  const result = streamText({
    // Any AI Gateway model: https://vercel.com/ai-gateway/models
    model: "anthropic/claude-sonnet-5",
    instructions: `You are a helpful assistant.

Use the search tool when an answer depends on facts you are not sure of: the user's documents, recent events, or anything specific you might misremember.

Search findings mark their evidence with labels like [S1]. When you use a finding, cite its label as a markdown link right after the claim, like [S1](#S1). Only cite labels that search returned. If search finds nothing relevant, say so instead of guessing.

Today is ${new Date().toISOString().slice(0, 10)}.`,
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: isStepCount(8),
    abortSignal: request.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
