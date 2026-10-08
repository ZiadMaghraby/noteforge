# Noteforge

A Notion-inspired workspace app for notes, connected pages, and project databases. Original branding; the first milestone is a working single-user workspace, not full Notion parity.

## First milestone

- Page tree, nested pages, breadcrumbs, favorites, search, icons, and covers.
- Eleven block types, slash commands, checklists, block movement, and keyboard editing.
- Database table, board, and list views with editable properties, filters, sorting, and task details.
- Durable D1 storage, owner-scoped queries, input validation, and optimistic save versions.
- Recoverable page trash, duplicate/move workflows, Markdown export, and JSON backup.
- Responsive layout, light/dark appearance, and accessible dialogs.

Rich text, custom database properties, attachments, comments, shared workspaces, and real-time collaboration are follow-up work. See ROADMAP.md and DEVELOPMENT.md for the actual status.

## Run locally

Requires Node 24 and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

Apply each pending local schema migration once, using its actual generated filename:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_eager_manta.sql
pnpm dev
```

Open the local URL printed by the server. Use the local **Sign in with ChatGPT** link to start the bundled local test identity. Local mock sign-in exists only in development; production identity is supplied by the Sites dispatcher.

When using the Sites plugin, use its build and publishing workflow. This checkout currently has no registered hosted Site. `.openai/hosting.json` declares only the logical DB binding.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm test:api
pnpm build
```

`test:api` requires the development server and local migrations. It creates named disposable test pages and moves them to recoverable trash after the checks. It checks authentication, persisted read-back, stale versions, invalid fields, invalid parents, page cycles, and cross-origin writes. It does not establish full multi-user sharing or production authentication coverage.

## Architecture

- Vinext, React 19, TypeScript, and Cloudflare Workers.
- Cloudflare D1 with Drizzle-generated schema migrations.
- `/api/workspace` loads the signed-in owner's workspace.
- `/api/pages` creates pages; `/api/pages/:id` saves validated changes with an expected version.
- Pages contain typed block documents or task records. Browser storage holds only appearance preferences.
- Writes are serialized per page; conflicts retain the local draft for export rather than overwriting server data.

Never expose a standalone Worker that trusts forwarded identity headers directly to the public internet. Production deployment must preserve the dispatcher authentication boundary; a different host requires a real authentication adapter.

## Development

Feature branches and reviewable PRs are the delivery units. ROADMAP.md records the seven-day target; DEVELOPMENT.md records observed results and limitations. No credentials, local databases, or user content belong in Git.

Interaction references: [Notion writing and editing](https://www.notion.com/help/writing-and-editing-basics) and [database basics](https://www.notion.com/help/intro-to-databases).
