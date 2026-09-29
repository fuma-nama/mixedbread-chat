# Bread Chat

A ChatGPT-style chat template that answers from your documents and the web, with citations. Built with Next.js, the [AI SDK](https://ai-sdk.dev), [shadcn/ui](https://ui.shadcn.com) on Base UI, and [Mixedbread](https://www.mixedbread.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmixedbread-ai%2Fmixedbread-chat&env=BETTER_AUTH_SECRET&envDescription=A%20random%20string%20for%20signing%20sessions&envLink=https%3A%2F%2Fgithub.com%2Fmixedbread-ai%2Fmixedbread-chat%23deploy&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%5D)

## Features

- Sign in with Mixedbread, then search the stores of every organization you connect, and the web, with numbered citations and source previews
- Pick what each question searches: the web, all of an organization's stores (Toast picks among them), or just some
- Chat history with titles, search, rename, delete and share links
- Edit a message or retry an answer, then flip between versions
- Every tool-calling model on [AI Gateway](https://vercel.com/ai-gateway), each with the thinking efforts it takes, or Toast 1 answering straight from your sources
- Citations preview the passage they quote, and a cited PDF page opens with that passage marked
- Sharing a chat says when it quotes your stores
- Reasoning, code highlighting and math

## How it works

1. A chat model on AI Gateway runs the conversation.
2. When it needs facts, it calls one `search` tool, which hands the request to [Toast 1](https://www.mixedbread.com/docs/agent/models), Mixedbread's search agent, with the signed-in person's own access. Toast searches the picked stores and the web, reads what it finds, and answers with citations. A Mixedbread token reaches one organization, so a search over several runs one Toast search per organization, side by side.
3. The tool labels each cited source `[S1]`, `[S2]` so the chat model can cite the same evidence, and the UI renders those labels as numbered citations, with the passage Toast read.

Pick Toast 1 as the model and there is no chat model in between: the same search runs with the whole conversation, and Toast's cited findings are the answer.

People sign in with their Mixedbread account through OAuth, handled by [Better Auth](https://www.better-auth.com). Each organization they connect is stored as its own account, with its tokens encrypted. Chats live in Postgres. Each message stores its parent, so edits and retries become branches of one chat.

## Run locally

```bash
pnpm install
cp .env.example .env.local # fill in the values
pnpm mixedbread:register http://localhost:3000 # prints MXBAI_CLIENT_ID for .env.local
pnpm db:migrate
pnpm dev
```

## Deploy

The Deploy button creates a Neon Postgres database and asks for `BETTER_AUTH_SECRET`. Every build runs the migrations, then registers the app with Mixedbread for the address it deploys to. The client is kept in the database, so later builds reuse it and connected organizations keep working.

- Preview deployments get a client of their own.
- On a custom domain, set `BETTER_AUTH_URL`.
- To bring your own client, set `MXBAI_CLIENT_ID`, and the build registers nothing.

## Search your own data

Create a store in the [Mixedbread platform](https://platform.mixedbread.com), then upload files or connect Google Drive, Notion, Slack and more. It shows up in the sources menu next to the model picker once you sign in to its organization.

## Customize

| What                                  | Where                                       |
| ------------------------------------- | ------------------------------------------- |
| Featured models and system prompt     | `lib/models.ts`, `app/api/chat/route.ts`    |
| Daily limits                          | `lib/limits.ts`                             |
| Suggested questions on a new chat     | `lib/suggestions.ts`                        |
| The search tool and what it can reach | `lib/search-tool.ts`, `lib/sources.ts`      |
| Sign-in and OAuth client registration | `lib/auth.ts`, `scripts/register-client.ts` |
| Database schema and queries           | `lib/db/`                                   |
| Chat UI and sidebar                   | `components/chat/`, `components/sidebar/`   |
| Primitives and theme                  | `components/ui/` and `app/globals.css`      |
| Logo, halftone mark and bakery icons  | `components/brand/`                         |

Everything that depends on Mixedbread's API lives in `lib/mixedbread/`, so upstream changes stay there:

| File               | Owns                                                         |
| ------------------ | ------------------------------------------------------------ |
| `platform.ts`      | OAuth provider, scopes and what a token says                 |
| `organizations.ts` | Connected organizations, their tokens and stores             |
| `research.ts`      | The Toast request, and its stream parsed into app types      |
| `citations.ts`     | Citation labels                                              |
| `files.ts`         | Pages of parsed files, for showing what a citation points at |
| `runs.ts`          | Splitting a search into runs per organization, and merging   |

After changing `lib/db/schema.ts`, run `pnpm db:generate` to add a migration.

## License

MIT
