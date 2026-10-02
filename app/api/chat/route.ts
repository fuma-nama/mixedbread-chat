import {
  convertToModelMessages,
  createUIMessageStream,
  generateText,
  isStepCount,
  JsonToSseTransformStream,
  streamText,
  toUIMessageStream,
  UI_MESSAGE_STREAM_HEADERS,
} from "ai";
import { after } from "next/server";
import { z } from "zod";
import { chatRuns, claimChat, holdChat } from "@/lib/answers";
import { pathTo } from "@/lib/branches";
import {
  appendMessage,
  countAnswers,
  createChat,
  getChat,
  getLeafRole,
  getMessages,
  saveParts,
  updateChat,
} from "@/lib/db/queries";
import { answersPerDay } from "@/lib/limits";
import { nextLabel } from "@/lib/messages";
import { listModels, titleModel } from "@/lib/models";
import { isReasoning, type Reasoning } from "@/lib/reasoning";
import { type ChatMessage, searchTool } from "@/lib/search-tool";
import {
  type SearchScope,
  scopeOf,
  sourceSelectionSchema,
} from "@/lib/sources";
import { toastModel } from "@/lib/toast-model";
import { getViewer } from "@/lib/viewer";

// Answers run on after the request that starts them; this ends them.
export const maxDuration = 300;

const id = z.string().max(100);

const settingsSchema = z.object({
  model: z.string(),
  reasoning: z.custom<Reasoning>(isReasoning),
  sources: sourceSelectionSchema,
});

const requestSchema = settingsSchema.extend({
  id,
  /** A new message, or a saved one to answer again. */
  message: z.object({
    id,
    role: z.literal("user"),
    parts: z.tuple([
      z.object({
        type: z.literal("text"),
        text: z.string().min(1).max(20_000),
      }),
    ]),
  }),
  /** For an edit or retry; without, it follows the chat's latest. */
  parentId: id.nullable().optional(),
});

type Settings = z.infer<typeof settingsSchema>;
type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

// Untold, models answer about the user's documents from memory, or say they can't see them.
const documents =
  "The search tool is your only way to read the user's documents, which live in their Mixedbread stores. Search before answering anything about their documents, work or organization, and never say you can't see them.";
const recent =
  "Search for facts that are recent or that you might misremember.";
const guidance: Record<SearchScope, string> = {
  docs: documents,
  both: `${documents} ${recent}`,
  web: recent,
  none: "The user turned search off for this question, so answer from what you know and say when you are unsure.",
};

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Please reload the page.", { status: 401 });
  const { user } = viewer;

  const body = requestSchema.safeParse(await request.json());
  if (!body.success) return new Response("Invalid request.", { status: 400 });
  const { id, message, parentId, model, reasoning, sources } = body.data;
  if (!(await listModels()).some((entry) => entry.id === model)) {
    return new Response("Invalid request.", { status: 400 });
  }

  const [answers, chat] = await Promise.all([
    countAnswers(user.id, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    getChat(id),
  ]);
  if (answers >= answersPerDay) {
    return new Response("You reached today's message limit.", { status: 429 });
  }
  if (chat && chat.userId !== user.id) {
    return new Response("Chat not found.", { status: 404 });
  }
  // Edits and retries wait until the chat rests.
  if (parentId !== undefined && chat && (await chatRuns(id))) {
    return new Response("This chat is answering already.", { status: 409 });
  }

  let naming: Promise<void> | undefined;
  if (!chat) {
    const [{ text }] = message.parts;
    await createChat({
      id,
      userId: user.id,
      title: text.split("\n", 1)[0].slice(0, 80),
    });
    naming = nameChat(id, user.id, text).catch(console.error);
    after(() => naming);
  }
  await appendMessage(id, message, parentId);
  if (!(await claimChat(id, JSON.stringify({ model, reasoning, sources })))) {
    return new Response(null, { status: 202 });
  }
  // The sending tab reads the first answer here; all else goes through Redis.
  const first = Promise.withResolvers<ReadableStream<string> | null>();
  const running = run(id, viewer, naming, first.resolve)
    .catch(console.error)
    .finally(() => first.resolve(null));
  after(() => running);
  const stream = await first.promise;
  if (!stream) return new Response(null, { status: 202 });
  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    status: 201,
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}

/** Answers one at a time while the latest message is the user's and sent since the last look. */
async function run(
  chatId: string,
  viewer: Viewer,
  naming?: Promise<void>,
  reply?: (stream: ReadableStream<string> | null) => void,
) {
  // Leaving the tab doesn't stop answers; Stop and the time limit do.
  const limit = AbortSignal.timeout((maxDuration - 20) * 1000);
  let stop = new AbortController();
  const hold = await holdChat(chatId, () => stop.abort());
  try {
    while (!limit.aborted) {
      // Stop ends only the answer it reaches.
      stop = new AbortController();
      const sent = await hold.next();
      if (sent && (await getLeafRole(chatId)) === "user") {
        const answering = await answer(
          chatId,
          viewer,
          settingsSchema.parse(JSON.parse(sent)),
          AbortSignal.any([stop.signal, limit]),
          naming,
        );
        naming = undefined;
        // Without Redis, it still runs and is kept; tabs catch up once it ends.
        const copy = await hold
          .show(answering.id, answering.stream)
          .catch((error) => {
            console.error(error);
            return null;
          });
        if (reply) reply(copy);
        else void copy?.cancel();
        reply = undefined;
        await answering.finished;
      } else if (await hold.release()) {
        return;
      }
    }
  } finally {
    await hold.end();
  }
}

async function answer(
  chatId: string,
  viewer: Viewer,
  { model, reasoning, sources }: Settings,
  signal: AbortSignal,
  naming?: Promise<void>,
) {
  const chosen = (await listModels()).find((entry) => entry.id === model);
  const toast = chosen?.toast === true;
  const messageId = crypto.randomUUID();
  // Kept at once, so messages sent while it runs go after it.
  const parentId = await appendMessage(chatId, {
    id: messageId,
    role: "assistant",
    parts: [],
  });
  const history: ChatMessage[] = pathTo(await getMessages(chatId), parentId);
  const tools = {
    search: searchTool({
      userId: viewer.user.id,
      connections: viewer.connections,
      selection: sources,
      firstLabel: nextLabel(history),
      toast,
    }),
  };
  const scope = scopeOf(sources, viewer.organizations);
  const searching = scope !== "none";
  const first = !history.some((message) => message.role === "assistant");

  const finished = Promise.withResolvers<void>();
  const stream = createUIMessageStream<ChatMessage>({
    async execute({ writer }) {
      try {
        const result = streamText({
          model: toast ? toastModel : model,
          reasoning:
            reasoning !== "auto" && chosen?.efforts.includes(reasoning)
              ? reasoning
              : "provider-default",
          prepareStep: ({ stepNumber }) =>
            first && searching && stepNumber === 0
              ? { toolChoice: "required" }
              : undefined,
          instructions: `You are a helpful assistant.

${guidance[scope]}

Search findings mark their evidence with labels like [S1]. When you use a finding, cite its label as a markdown link right after the claim, like [S1](#S1). Only cite labels that search returned. If search finds nothing relevant, say so instead of guessing.

The user can send messages while you answer. Finish what came before unless a new message replaces it, then take it up.

Write math between double dollar signs, inline like $$E = mc^2$$ or on lines of their own for a display equation. A single dollar sign is always read as a dollar, as in prices.

Today is ${new Date().toISOString().slice(0, 10)}.`,
          // A search cut short by Stop has no result.
          messages: await convertToModelMessages(history, {
            tools,
            ignoreIncompleteToolCalls: true,
          }),
          tools,
          // Earlier searches in the history need the tool even when search is off.
          // History with searches needs the tool even when search is off.
          activeTools: searching ? ["search"] : [],
          // A message sent meanwhile ends it at the next step, and the next
          // answer takes it up. Toast searches and writes up in one go.
          stopWhen: toast
            ? isStepCount(8)
            : [
                isStepCount(8),
                async () => (await getChat(chatId))?.leafId !== messageId,
              ],
          abortSignal: signal,
        });
        let parts: ChatMessage["parts"] = [];
        let ended: "stopped" | "failed" | undefined;
        const answer = toUIMessageStream<typeof tools, ChatMessage>({
          stream: result.stream,
          originalMessages: history,
          generateMessageId: () => messageId,
          sendFinish: false,
          // Also runs after Stop, so what it wrote is kept.
          onEnd: ({ responseMessage }) => {
            parts = responseMessage.parts;
          },
        });
        for await (const chunk of answer) {
          if (chunk.type === "error") ended = "failed";
          else writer.write(chunk);
        }
        if (signal.aborted) {
          ended = signal.reason?.name === "TimeoutError" ? "failed" : "stopped";
        }
        if (ended) {
          writer.write({ type: "data-ended", data: ended });
          parts = [...parts, { type: "data-ended", data: ended }];
        }
        // Saved and named before tabs hear it ended, so the chat they load has both.
        await saveParts(messageId, parts);
        await naming;
        writer.write({
          type: "finish",
          finishReason: ended === "stopped" ? "other" : "stop",
        });
      } finally {
        finished.resolve();
      }
    },
  });
  return {
    id: `${chatId}:${messageId}`,
    stream: stream.pipeThrough(new JsonToSseTransformStream()),
    finished: finished.promise,
  };
}

async function nameChat(id: string, userId: string, text: string) {
  const { text: generated } = await generateText({
    model: titleModel,
    instructions:
      "Write a title of at most six words for a chat that starts with the user's message. Reply with the title only, without quotes.",
    prompt: text.slice(0, 2000),
  }).catch(() => ({ text: "" }));
  const title = generated.trim();
  if (title) await updateChat(id, userId, { title });
}
