# Mixedbread Chat

A ChatGPT-style chat template that answers from your documents and the web, with citations. Built with Next.js, the [AI SDK](https://ai-sdk.dev), [shadcn/ui](https://ui.shadcn.com) on Base UI, and [Mixedbread](https://www.mixedbread.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmixedbread-ai%2Fmixedbread-chat&env=MXBAI_API_KEY&envDescription=Your%20Mixedbread%20API%20key&envLink=https%3A%2F%2Fplatform.mixedbread.com%2Fplatform%3Fnext%3Dapi-keys)

## How it works

1. Any model on the [Vercel AI Gateway](https://vercel.com/ai-gateway) runs the conversation.
2. When it needs facts, it calls one `search` tool, which hands the request to [Toast 1](https://www.mixedbread.com/docs/agent/models), Mixedbread's search agent. Toast searches your stores and the web, reads what it finds, and answers with citations.
3. The tool labels each cited source `[S1]`, `[S2]` so the chat model can cite the same evidence, and the UI renders those labels as numbered citations.

## Run locally

```bash
pnpm install
cp .env.example .env.local # add MXBAI_API_KEY and AI_GATEWAY_API_KEY
pnpm dev
```

## Search your own data

Create a store in the [Mixedbread platform](https://platform.mixedbread.com), upload files or connect Google Drive, Notion, Slack and more, then list the stores to search:

```bash
MXBAI_STORES=my-docs,mixedbread/web
```

Leave out `mixedbread/web` to answer from your documents only.

## Customize

| What | Where |
| --- | --- |
| Chat model and system prompt | `app/api/chat/route.ts` |
| The search tool | `lib/search-tool.ts` |
| Toast request and citation labels | `lib/mixedbread/` |
| Chat UI | `components/chat/` |
| Primitives and theme | `components/ui/` and `app/globals.css` |

## License

MIT
