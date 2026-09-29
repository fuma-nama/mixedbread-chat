import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { pathTo } from "@/lib/branches";
import {
  countAnswers,
  createChat,
  getChat,
  getMessages,
  saveMessage,
  updateChat,
} from "@/lib/db/queries";
import { languageModel } from "@/lib/language-model";
import { answersPerDay } from "@/lib/limits";
import { nextLabel } from "@/lib/messages";
import { listModels, titleModel } from "@/lib/models";
import { isReasoning, type Reasoning } from "@/lib/reasoning";
import { type ChatMessage, searchTool } from "@/lib/search-tool";
import { scopeOf, sourceSelectionSchema } from "@/lib/sources";
import { toastModel } from "@/lib/toast-model";
import { getViewer } from "@/lib/viewer";

const requestSchema = z.object({
  id: z.string(),
  /** The user message to answer: a new one, or a saved one on a retry. */
  message: z.object({
    id: z.string(),
    role: z.literal("user"),
    parts: z
      .array(
        z.object({
          type: z.literal("text"),
          text: z.string().min(1).max(20_000),
        }),
      )
      .min(1),
  }),
  parentId: z.string().nullable(),
  model: z.string(),
  reasoning: z.custom<Reasoning>(isReasoning),
  /** What the picker says to search. */
  sources: sourceSelectionSchema,
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Please reload the page.", { status: 401 });
  const { user } = viewer;

  const body = requestSchema.safeParse(await request.json());
  if (!body.success) return new Response("Invalid request.", { status: 400 });
  const { id, message, parentId, model, reasoning, sources } = body.data;
  const chosen = (await listModels()).find((entry) => entry.id === model);
  if (!chosen) return new Response("Invalid request.", { status: 400 });

  const [answers, chat, saved] = await Promise.all([
    countAnswers(user.id, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    getChat(id),
    getMessages(id),
  ]);
  if (answers >= answersPerDay) {
    return new Response("You reached today's message limit.", { status: 429 });
  }
  if (chat && chat.userId !== user.id) {
    return new Response("Chat not found.", { status: 404 });
  }

  let naming: Promise<string | undefined> | undefined;
  if (!chat) {
    let text = "";
    for (const part of message.parts) text += (text && "\n") + part.text;
    await createChat({ id, userId: user.id, title: text.slice(0, 80) });
    naming = nameChat(id, user.id, text);
  }
  await saveMessage({ ...message, chatId: id, parentId });

  // On a retry the message is saved already, and the saved copy wins.
  const history: ChatMessage[] = pathTo(
    [{ ...message, parentId }, ...saved],
    message.id,
  );
  const toast = chosen.toast === true;
  const tools = {
    search: searchTool({
      userId: user.id,
      connections: viewer.connections,
      selection: sources,
      firstLabel: nextLabel(history),
      toast,
    }),
  };
  // Earlier searches in the history still need the tool, even when it is off.
  const searching = scopeOf(sources, viewer.organizations) !== "none";

  const result = streamText({
    model: toast ? toastModel : languageModel(model),
    // Auto, or an effort the model doesn't take, is left to its provider.
    reasoning:
      reasoning !== "auto" && chosen.efforts.includes(reasoning)
        ? reasoning
        : "provider-default",
    instructions: `You are a helpful assistant.

${
  searching
    ? "Use the search tool when an answer depends on facts you are not sure of: the user's documents, recent events, or anything specific you might misremember."
    : "The user turned search off for this question, so answer from what you know and say when you are unsure."
}

Search findings mark their evidence with labels like [S1]. When you use a finding, cite its label as a markdown link right after the claim, like [S1](#S1). Only cite labels that search returned. If search finds nothing relevant, say so instead of guessing.

Write math between double dollar signs, inline like $$E = mc^2$$ or on lines of their own for a display equation. A single dollar sign is always read as a dollar, as in prices.

Today is ${new Date().toISOString().slice(0, 10)}.`,
    messages: await convertToModelMessages(history, { tools }),
    tools,
    activeTools: searching ? ["search"] : [],
    stopWhen: isStepCount(8),
    abortSignal: request.signal,
  });

  const answer = toUIMessageStream({
    stream: result.stream,
    originalMessages: history,
    generateMessageId: () => crypto.randomUUID(),
    // Also runs after Stop, so a partial answer is kept.
    async onEnd({ responseMessage }) {
      await saveMessage({
        id: responseMessage.id,
        chatId: id,
        parentId: message.id,
        role: "assistant",
        parts: responseMessage.parts,
      });
      await updateChat(id, user.id, {
        leafId: responseMessage.id,
        updatedAt: new Date(),
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream<ChatMessage>({
      async execute({ writer }) {
        writer.merge(answer);
        // The title usually lands while the answer streams, so the sidebar
        // can show it right away. Waiting also keeps the function alive
        // until it is saved.
        const title = await naming;
        if (title)
          writer.write({ type: "data-title", data: title, transient: true });
      },
    }),
  });
}

/** Replaces the placeholder title; the first line stays if naming fails. */
async function nameChat(id: string, userId: string, text: string) {
  const { text: generated } = await generateText({
    model: languageModel(titleModel),
    instructions:
      "Write a title of at most six words for a chat that starts with the user's message. Reply with the title only, without quotes.",
    prompt: text.slice(0, 2000),
  }).catch(() => ({ text: "" }));
  const title = generated.trim();
  if (!title) return undefined;
  await updateChat(id, userId, { title });
  return title;
}
