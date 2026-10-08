# Development notes

## October 8, 2026 — Workspace foundation

The first version supports nested pages, a block editor, and task databases backed by D1.

### Included

- Page navigation, favorites, search, icons, covers, templates, duplicate, move, and recoverable trash.
- Eleven block types, slash commands, checklists, block splitting, and reorder controls.
- Database table, board, and list views with task properties, search, status filtering, and name sorting.
- Markdown export, JSON backup, responsive layout, and dark appearance.
- Owner-scoped queries, input validation, and version checks to prevent stale saves from overwriting newer data.

### Validation

- TypeScript, three domain tests, and the production build passed locally and in GitHub Actions.
- The initial D1 migration applied successfully.
- API smoke checks covered authentication, persisted read-back, stale revisions, invalid inputs and parents, page cycles, cross-origin writes, and trash.
- Browser checks covered saved edits after reload, slash commands, database views and status changes, trash/restore, mobile layout, and dark appearance.
- The read-only page-list tool accepts an empty input object and rejects unexpected fields.

### Next

Inline rich text, custom database properties, saved views, attachments, and collaboration are still planned. Production hosting is not configured yet. The local preview uses a development identity; production identity and isolation need deployment-level testing before a public app release.

See ROADMAP.md for the release plan.
