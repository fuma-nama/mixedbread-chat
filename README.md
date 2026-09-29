# Mixedbread Chat

A ChatGPT-style chat template that answers from your documents and the web, with citations. Built with Next.js, the [AI SDK](https://ai-sdk.dev), [shadcn/ui](https://ui.shadcn.com) on Base UI, and [Mixedbread](https://www.mixedbread.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmixedbread-ai%2Fmixedbread-chat&env=MXBAI_API_KEY%2CBETTER_AUTH_SECRET&envDescription=Your%20Mixedbread%20API%20key%2C%20and%20a%20random%20string%20for%20signing%20sessions&envLink=https%3A%2F%2Fgithub.com%2Fmixedbread-ai%2Fmixedbread-chat%23deploy&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%5D)

## Features

- Answers that search your Mixedbread stores and the web, with numbered citations and source previews
- Chat history with titles, search, rename, delete and share links
- Edit a message or retry an answer, then flip between versions
- Model picker over [AI Gateway](https://vercel.com/ai-gateway), reasoning, code highlighting and math
- Guest chats from the first visit; signing up keeps them

## How it works

1. A chat model on AI Gateway runs the conversation.
2. When it needs facts, it calls one `search` tool, which hands the request to [Toast 1](https://www.mixedbread.com/docs/agent/models), Mixedbread's search agent. Toast searches your stores and the web, reads what it finds, and answers with citations.
3. The tool labels each cited source `[S1]`, `[S2]` so the chat model can cite the same evidence, and the UI renders those labels as numbered citations.

Chats live in Postgres. Each message stores its parent, so edits and retries become branches of one chat. [Better Auth](https://www.better-auth.com) gives every visitor a guest account and links it on sign-up.

## Run locally

```bash
pnpm install
cp .env.example .env.local # fill in the values
pnpm db:migrate
pnpm dev
```

## Deploy

The Deploy button creates a Neon Postgres database and asks for `MXBAI_API_KEY` and `BETTER_AUTH_SECRET`. Migrations run on every build. On a custom domain, also set `BETTER_AUTH_URL`.

## Search your own data

Create a store in the [Mixedbread platform](https://platform.mixedbread.com), upload files or connect Google Drive, Notion, Slack and more, then list the stores to search:

```bash
MXBAI_STORES=my-docs,mixedbread/web
```

Leave out `mixedbread/web` to answer from your documents only.

## Customize

| What                                 | Where                                     |
| ------------------------------------ | ----------------------------------------- |
| Chat models and system prompt        | `lib/models.ts`, `app/api/chat/route.ts`  |
| Daily limits                         | `lib/limits.ts`                           |
| Suggested questions on a new chat    | `lib/suggestions.ts`                      |
| The search tool                      | `lib/search-tool.ts`                      |
| Toast request and citation labels    | `lib/mixedbread/`                         |
| Database schema and queries          | `lib/db/`                                 |
| Sign-in methods                      | `lib/auth.ts`                             |
| Chat UI and sidebar                  | `components/chat/`, `components/sidebar/` |
| Primitives and theme                 | `components/ui/` and `app/globals.css`    |
| Logo, halftone mark and bakery icons | `components/brand/`                       |

After changing `lib/db/schema.ts`, run `pnpm db:generate` to add a migration.

## License

MIT
