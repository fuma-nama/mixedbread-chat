import { createHash } from "node:crypto";
import { readChat } from "@/lib/viewer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const chat = await readChat((await params).id);
  if (!chat) return new Response(null, { status: 404 });
  const body = JSON.stringify(chat);
  // A tab catching up on an unchanged chat gets no copy.
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
