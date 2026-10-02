# Bread Chat

A ChatGPT-style chat template that answers from your documents and the web, with citations. Built with Next.js, the [AI SDK](https://ai-sdk.dev), [Base UI](https://base-ui.com) and [Mixedbread](https://www.mixedbread.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffuma-nama%2Fmixedbread-chat&env=BETTER_AUTH_SECRET&envDescription=A%20random%20string%20for%20signing%20sessions&envLink=https%3A%2F%2Fgithub.com%2Ffuma-nama%2Fmixedbread-chat%23deploy&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22upstash-kv%22%2C%22integrationSlug%22%3A%22upstash%22%7D%5D)

## Features

- **Connect with Mixedbread:** sign in with Mixedbread, then search the web and the Mixedbread stores you selected.
- **Numbered citations:** preview the quoted documents.
- **Any model:** any tool-calling model on [AI Gateway](https://vercel.com/ai-gateway), with its thinking efforts.
- **Chat history:** titles, search, rename, delete and share links, with resumable & cross-device streaming.
- **Branches:** edit a message or retry an answer, then flip between versions.
- **Rich answers:** reasoning, code highlighting and math.

## How it works

A chat model on AI Gateway runs the conversation. When it needs facts, it searches your stores and the web with [Toast 1](https://www.mixedbread.com/docs/agent/models), Mixedbread's search agent, and cites what it finds.

Chats are stored in Postgres, and answers stream through Redis, so they keep running after you close the tab.

## Run locally

```bash
pnpm install
cp .env.example .env.local # fill in the values
pnpm mixedbread:register http://localhost:3000 # prints MXBAI_CLIENT_ID for .env.local
pnpm db:migrate
pnpm dev
```

## Deploy

The Deploy button sets up Neon Postgres and Upstash Redis, and asks for `BETTER_AUTH_SECRET`. Each build runs the migrations and registers the app with Mixedbread, keeping the client in the database for later builds.

- Preview deployments get their own client.
- On a custom domain, set `BETTER_AUTH_URL`.
- To bring your own client, set `MXBAI_CLIENT_ID`.

## Search your own data

Create a store on the [Mixedbread platform](https://platform.mixedbread.com), then upload files or connect Google Drive, Notion, Slack and more. It shows up in the sources menu once you sign in to its organization.

## Customize

| What                                  | Where                                       |
| ------------------------------------- | ------------------------------------------- |
| Models and system prompt              | `lib/models.ts`, `app/api/chat/route.ts`    |
| Daily limits                          | `lib/limits.ts`                             |
| Suggested questions                   | `lib/suggestions.ts`                        |
| The search tool and what it can reach | `lib/search-tool.ts`, `lib/sources.ts`      |
| Sign-in and OAuth client registration | `lib/auth.ts`, `scripts/register-client.ts` |
| Mixedbread API                        | `lib/mixedbread/`                           |
| Database schema and queries           | `lib/db/`                                   |
| Chat UI and sidebar                   | `components/chat/`, `components/sidebar/`   |
| Primitives and theme                  | `components/ui/`, `app/globals.css`         |
| Brand assets                          | `components/brand/`                         |

After changing `lib/db/schema.ts`, run `pnpm db:generate` to add a migration.

## License

MIT
