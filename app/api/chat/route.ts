import {
  convertToModelMessages,
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
import { isModelId, type ModelId, titleModel } from "@/lib/models";
import { type ChatMessage, nextLabel, searchTool } from "@/lib/search-tool";

const answersPerDay = { guest: 20, member: 100 };

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
  if ((await countAnswers(user.id, since)) >= limit) {
    return new Response(
      user.isAnonymous
        ? "You reached today's limit for guests. Sign up to keep chatting."
        : "You reached today's message limit.",
      { status: 429 },
    );
  }

  const chat = await getChat(id);
  if (chat && chat.userId !== user.id) {
    return new Response("Chat not found.", { status: 404 });
  }

  let naming: Promise<void> | undefined;
  if (!chat) {
    const text = message.parts.map((part) => part.text).join("\n");
    await createChat({ id, userId: user.id, title: text.slice(0, 80) });
    naming = nameChat(id, user.id, text);
  }
  await saveMessage({ ...message, chatId: id, parentId });

  const history: ChatMessage[] = pathTo(await getMessages(id), message.id).map(
    ({ id, role, parts }) => ({ id, role, parts }),
  );
  const tools = { search: searchTool(nextLabel(history)) };

  const result = streamText({
    model,
    instructions: `You are a helpful assistant.

Use the search tool when an answer depends on facts you are not sure of: the user's documents, recent events, or anything specific you might misremember.

Search findings mark their evidence with labels like [S1]. When you use a finding, cite its label as a markdown link right after the claim, like [S1](#S1). Only cite labels that search returned. If search finds nothing relevant, say so instead of guessing.

Today is ${new Date().toISOString().slice(0, 10)}.`,
    messages: await convertToModelMessages(history, { tools }),
    tools,
    stopWhen: isStepCount(8),
    abortSignal: request.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
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
        await naming;
      },
    }),
  });
}

/** Replaces the placeholder title; the first line stays if naming fails. */
async function nameChat(id: string, userId: string, text: string) {
  const { text: title } = await generateText({
    model: titleModel,
    instructions:
      "Write a title of at most six words for a chat that starts with the user's message. Reply with the title only, without quotes.",
    prompt: text.slice(0, 2000),
  }).catch(() => ({ text: "" }));
  if (title) await updateChat(id, userId, { title: title.trim() });
}
