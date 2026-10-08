# Contributing

Use Node 24 and pnpm 11. Install with `pnpm install --frozen-lockfile`.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before requesting review. See README.md for local D1 setup and the API smoke check.

Prefer feature branches and one coherent change per pull request. Explain the user-visible behavior, validation, and known limits. Keep credentials, `.env` files, local databases, build output, and user content out of commits.

For bug reports, include steps to reproduce, the expected behavior, and your Node version. For larger changes, open an issue to discuss the approach before starting implementation.
