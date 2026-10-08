# Noteforge · Seven-day delivery plan

Work started October 8, 2026. Target handoff: October 15, 2026, Africa/Cairo.

Noteforge is an original Notion-inspired workspace app. The goal is a substantial, working product with an editor, connected pages, and flexible databases. Full Notion feature parity is outside a seven-day release.

## Day 1 · Workspace foundation

- [x] Set up the GitHub repository.
- [x] Define pages, typed blocks, database rows, and durable D1 storage.
- [x] Implement workspace ownership and optimistic save versions.
- [x] Build the page tree, favorites, breadcrumbs, search, and templates.
- [x] Validate the first local preview, API, and production build.
- [x] Publish the foundation source and open a reviewable PR.

## Day 2 · Writing and page workflows

- Inline rich text, links, undo and redo.
- Improve slash commands, keyboard navigation, and paste behavior.
- Test nested pages, duplicate, move, trash, and restore thoroughly.

## Day 3 · Databases

- Custom properties and saved views.
- Table, board, and list refinements, then calendar support.
- Bulk actions, useful filters, sorting, and task detail workflows.

## Day 4 · Templates and portability

- More substantial project, knowledge base, and journal templates.
- Markdown and CSV import/export.
- Attachments if hosting/storage access is available.

## Day 5 · Collaboration

- Comments and activity history.
- Membership and sharing permission design, with server-side enforcement.
- Multi-user flows only when hosting and identity integration can be tested.
- Real-time collaboration is a stretch goal and requires multi-client testing.

## Day 6 · Quality and resilience

- Accessibility and keyboard checks.
- Small-screen and dark-theme checks.
- Save failure, version conflict, ownership, and recovery tests.
- CI and documentation updates.

## Day 7 · Release

- Fix remaining failures and audit feature claims against actual behavior.
- Publish if hosting access is available.
- Record the verified release, screenshots, checks, open limitations, and follow-up issues.

## Tracking progress

Feature work is tracked in pull requests. Each PR should describe the behavior it changes, the checks run, and any remaining limitations.

See DEVELOPMENT.md for completed work and verification results. The dates above are targets; deployment and collaboration depend on working hosting and identity integration.
