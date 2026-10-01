import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { followAnswer, runningAnswer, stopAnswer } from "@/lib/answers";
import { getSession } from "@/lib/auth";
import { getChat } from "@/lib/db/queries";

// A request follows an answer to its end, or waits for one to start and
// sends the tab to a new request for it.
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/** The chat's answer as it runs, once one does. Only its owner gets it. */
export async function GET(request: Request, { params }: Context) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!session) return new Response(null, { status: 401 });
  const ownerOf = async () => (await getChat(id))?.userId;
  // A new chat has no row until its first answer starts.
  const owner = await ownerOf();
  if (owner && owner !== session.user.id) {
    return new Response(null, { status: 404 });
  }
  const url = new URL(request.url);
  // The answer the wait below saw start, which may have ended since.
  let answer = url.searchParams.get("answer");
  if (!answer?.startsWith(`${id}:`)) {
    const { running, started } = await runningAnswer(
      id,
      request.signal,
      request.headers.has("x-busy"),
    );
    if (started) {
      url.searchParams.set("answer", started);
      return Response.redirect(url, 307);
    }
    if (!running) return new Response(null, { status: 204 });
    answer = running;
  }
  if ((owner ?? (await ownerOf())) !== session.user.id) {
    return new Response(null, { status: 404 });
  }
  const stream = await followAnswer(answer);
  // It ended as the tab came to it, so the tab catches up instead.
  if (!stream) return new Response(null, { status: 204 });
  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}

/** Stop. */
export async function DELETE(_request: Request, { params }: Context) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  const chat = session && (await getChat(id));
  if (chat && chat.userId === session.user.id) await stopAnswer(id);
  return new Response(null, { status: 204 });
}
