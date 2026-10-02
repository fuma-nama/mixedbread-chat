# Bread Chat

A ChatGPT-style chat template that answers from your documents and the web, with citations. Built with Next.js, the [AI SDK](https://ai-sdk.dev), [Base UI](https://base-ui.com) and [Mixedbread](https://www.mixedbread.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffuma-nama%2Fmixedbread-chat&env=BETTER_AUTH_SECRET&envDescription=A%20random%20string%20for%20signing%20sessions&envLink=https%3A%2F%2Fgithub.com%2Ffuma-nama%2Fmixedbread-chat%23deploy&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22upstash-kv%22%2C%22integrationSlug%22%3A%22upstash%22%7D%5D)

## Features

- Sign in with Mixedbread, then search the web and the stores of every organization you connect
- Pick what each question searches: the web, and each organization's stores on Auto (the chat model picks where to look) or Manual (all of them, or just some)
- Numbered citations that preview the passage they quote; a cited PDF page opens with it marked
- Any tool-calling model on [AI Gateway](https://vercel.com/ai-gateway), with the thinking efforts it takes
- Chat history with titles, search, rename, delete and share links, which say when a chat quotes your stores
- Edit a message or retry an answer, then flip between versions
- Reasoning, code highlighting and math

## How it works

1. A chat model on AI Gateway runs the conversation.
2. When it needs facts, it calls a `search` tool that hands the request to [Toast 1](https://www.mixedbread.com/docs/agent/models), Mixedbread's search agent, with the signed-in person's own access. Toast searches the picked stores and the web, reads what it finds, and answers with citations.
3. The tool labels each cited source `[S1]`, `[S2]`, so the chat model can cite the same evidence, and the UI renders the labels as numbered citations.

On Auto, the chat model first calls `find_stores` to find stores by name and description, and passes the ones it picks to `search`. A Mixedbread token reaches one organization, so a search over several runs one Toast search per organization, side by side.

- **Sign-in**: Mixedbread OAuth through [Better Auth](https://www.better-auth.com). Each connected organization is its own account, with encrypted tokens that can only read its stores and run Toast (`stores:read`, `completions:create`).
- **Chats**: stored in Postgres. Each message keeps its parent, so edits and retries branch one chat.
- **Answers**: run on the server through Redis, so closing the tab doesn't end them, and the owner's other tabs follow, join and stop them.

## Run locally

```bash
pnpm install
cp .env.example .env.local # fill in the values
pnpm mixedbread:register http://localhost:3000 # prints MXBAI_CLIENT_ID for .env.local
pnpm db:migrate
pnpm dev
```

## Deploy

The Deploy button creates a Neon Postgres database and an Upstash Redis, and asks for `BETTER_AUTH_SECRET`. Every build runs the migrations, then registers the app with Mixedbread for the address it deploys to. The client is kept in the database, so later builds reuse it and connected organizations keep working.

- Preview deployments get a client of their own.
- On a custom domain, set `BETTER_AUTH_URL`.
- To bring your own client, set `MXBAI_CLIENT_ID`, and the build registers nothing.

## Search your own data

Create a store in the [Mixedbread platform](https://platform.mixedbread.com), then upload files or connect Google Drive, Notion, Slack and more. It shows up in the sources menu next to the model picker once you sign in to its organization.

## Customize

| What                                  | Where                                       |
| ------------------------------------- | ------------------------------------------- |
| Models and system prompt              | `lib/models.ts`, `app/api/chat/route.ts`    |
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
| `platform.ts`      | OAuth provider, scopes and the organization a sign-in grants |
| `organizations.ts` | Connected organizations, their names, tokens and stores      |
| `research.ts`      | The Toast request, and its stream parsed into app types      |
| `citations.ts`     | Citation labels                                              |
| `files.ts`         | Pages of parsed files, for showing what a citation points at |
| `runs.ts`          | Finding stores, splitting a search into runs, and merging    |

After changing `lib/db/schema.ts`, run `pnpm db:generate` to add a migration.

## License

MIT
