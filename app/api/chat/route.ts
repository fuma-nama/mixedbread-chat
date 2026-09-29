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
import { getSession } from "@/lib/auth";
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
import { isModelId, type ModelId, titleModel } from "@/lib/models";
import { type ChatMessage, nextLabel, searchTool } from "@/lib/search-tool";

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
  model: z.custom<ModelId>(isModelId),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Please reload the page.", { status: 401 });
  const { user } = session;

  const body = requestSchema.safeParse(await request.json());
  if (!body.success) return new Response("Invalid request.", { status: 400 });
  const { id, message, parentId, model } = body.data;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limit = user.isAnonymous ? answersPerDay.guest : answersPerDay.member;
  const [answers, chat, saved] = await Promise.all([
    countAnswers(user.id, since),
    getChat(id),
    getMessages(id),
  ]);
  if (answers >= limit) {
    return new Response(
      user.isAnonymous
        ? "You reached today's limit for guests. Sign up to keep chatting."
        : "You reached today's message limit.",
      { status: 429 },
    );
  }
  if (chat && chat.userId !== user.id) {
    return new Response("Chat not found.", { status: 404 });
  }

  let naming: Promise<string | undefined> | undefined;
  if (!chat) {
    const text = message.parts.map((part) => part.text).join("\n");
    await createChat({ id, userId: user.id, title: text.slice(0, 80) });
    naming = nameChat(id, user.id, text);
  }
  await saveMessage({ ...message, chatId: id, parentId });

  // On a retry the message is saved already, and the saved copy wins.
  const history: ChatMessage[] = pathTo(
    [{ ...message, parentId }, ...saved],
    message.id,
  );
  const tools = { search: searchTool(nextLabel(history)) };

  const result = streamText({
    model: languageModel(model),
    instructions: `You are a helpful assistant.

Use the search tool when an answer depends on facts you are not sure of: the user's documents, recent events, or anything specific you might misremember.

Search findings mark their evidence with labels like [S1]. When you use a finding, cite its label as a markdown link right after the claim, like [S1](#S1). Only cite labels that search returned. If search finds nothing relevant, say so instead of guessing.

Write math between double dollar signs, inline like $$E = mc^2$$ or on lines of their own for a display equation. A single dollar sign is always read as a dollar, as in prices.

Today is ${new Date().toISOString().slice(0, 10)}.`,
    messages: await convertToModelMessages(history, { tools }),
    tools,
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
