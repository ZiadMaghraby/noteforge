# Noteforge

A workspace for notes, nested pages, and project databases, built with **C#, ASP.NET Core 10, Blazor, and Entity Framework Core SQLite**.

## Run locally

Install the .NET 10 SDK, then:

```sh
dotnet restore Noteforge.slnx
dotnet run --project server/Noteforge.Web
```

Open `http://localhost:5080` and create an account. Each account gets a private workspace with starter pages. The app creates and migrates `noteforge.db` in the web project directory. Keep this file to preserve accounts and pages; it is excluded from Git.

## What works

- Account registration, sign-in, and sign-out with ASP.NET Core Identity cookies.
- Nested pages, favorites, search, icons, covers, duplication, moving, trash, and restore.
- Block editor with text, headings, lists, checklists, quotes, code, dividers, and callouts. Enter splits a block; Shift+Enter adds a line; `/` opens block types.
- Autosave with version checks that reject conflicting writes and keep the local draft available for export.
- Project databases with table, board, and list views, filtering, sorting, task details, and status changes.
- Page templates, light/dark appearance, and a collapsible mobile sidebar.
- Markdown export and JSON backup/import. Import adds pages with new IDs and preserves the hierarchy and existing pages.

The UI uses Blazor Interactive Server, so editing needs an active connection to the server. A small JavaScript file handles browser focus, text selection, downloads, and appearance preferences; workspace behavior lives in C#.

## Structure

| Path | Purpose |
| --- | --- |
| `server/Noteforge.Web/Components` | Blazor pages, editor, and database views |
| `server/Noteforge.Web/Services` | Persistence, validation, imports, Markdown export |
| `server/Noteforge.Web/Data` | Identity/EF Core models, migrations, starter content |
| `server/Noteforge.Web/Endpoints` | Account and workspace HTTP endpoints |
| `tests/Noteforge.Tests` | Integration tests against temporary SQLite databases |

## Check the changes

```sh
dotnet build Noteforge.slnx --configuration Release
dotnet test Noteforge.slnx --configuration Release
dotnet publish server/Noteforge.Web --configuration Release --output artifacts/web
```

Tests cover authentication, CSRF protection, account isolation, stale versions, persistence across server instances, hierarchy validation, database rows, exports, and atomic backup validation. GitHub Actions builds, tests, and publishes the app on pull requests.

## Storage and HTTP API

Configure `ConnectionStrings__Workspace` to use a different SQLite path. Startup applies checked-in EF migrations by default; set `Database__ApplyMigrations=false` when migrations are managed separately. To manage migrations locally:

```sh
dotnet tool restore
dotnet ef database update --project server/Noteforge.Web
```

Authenticated endpoints: `GET /api/workspace`, `POST /api/pages`, `PATCH /api/pages/{id}`, and `POST /api/import`. Updates require the page's current `version`. Obtain a token from `GET /api/antiforgery`, retain the cookies, and send the token in `X-CSRF-TOKEN` for mutations, including login, registration, and logout. Fetch a new token after signing in or out. The Blazor UI calls the same persistence service directly.

Existing Noteforge JSON exports can be imported from Settings (up to 2 MB and 500 pages). Back up the SQLite database using a consistent SQLite backup or while the server is stopped; a live database may also have WAL files.

## Current limits

This is a working first version. Shared workspaces, collaborative editing, rich inline formatting, file attachments, email verification, and password recovery are not implemented. Before hosting it for other people, configure HTTPS, persistent database storage, persistent ASP.NET Core Data Protection keys, and a backup process. There is no public application deployment included in this repository.
