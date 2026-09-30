import { readChat } from "@/lib/viewer";

/** A chat for the client to switch to without a server-rendered page. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const chat = await readChat((await params).id);
  return chat ? Response.json(chat) : new Response(null, { status: 404 });
}
