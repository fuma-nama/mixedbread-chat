import { createHash } from "node:crypto";
import { readChat } from "@/lib/viewer";

/** A chat for the client to switch to without a server-rendered page. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const chat = await readChat((await params).id);
  if (!chat) return new Response(null, { status: 404 });
  const body = JSON.stringify(chat);
  // A tab catching up on a chat that hasn't changed gets no copy of it.
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      etag,
      "cache-control": "private, no-cache",
    },
  });
}
