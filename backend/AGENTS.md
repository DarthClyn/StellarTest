# Repository Guidelines

## Project Structure & Module Organization
- `server/`: Express resource server protected by x402 middleware (`index.js`, `.env.example`).
- `client/`: Node client that triggers `402` then retries with payment (`index.js`, `.env.example`).
- `figma/`: reference screenshots for demo UX states.
- Root workspace wiring lives in `pnpm-workspace.yaml` (includes `server` and `client`).

## Build, Test, and Development Commands
- `pnpm install` (root): install all workspace dependencies.
- `pnpm --filter server start`: run protected API on `PORT` (default `3000`).
- `pnpm --filter client start`: run Stellar payer client against `RESOURCE_SERVER_URL`.

## Coding Style & Naming Conventions
- JavaScript/TypeScript style follows existing code: ESM modules, semicolons, and 2-space indentation.
- Use `camelCase` for variables/functions, `PascalCase` for classes, and uppercase `SCREAMING_SNAKE_CASE` for env-derived constants.
- Keep files focused: one main responsibility per `index.js`/module.

## Testing Guidelines
- Root demo (`client/`, `server/`) currently has no dedicated automated test suite; validate by running server/client end-to-end.
- No repository-wide coverage threshold is defined; do not merge behavior changes without at least one reproducible verification path.

## Commit & Pull Request Guidelines
- Current history uses short, imperative, plain-language subjects (examples: `Add Readme`, `Remove paywall`, `tidy up`).
- Prefer concise commit titles under ~60 chars; expand reasoning in the body when needed.
- PRs should include: what changed, why, test evidence (command + result), and any `.env`/network assumptions.

## Security & Configuration Tips
- Copy `.env.example` files; never commit real secrets.
- Keep `NETWORK` aligned across client/server (`stellar:testnet` or `stellar:pubnet`) to avoid false payment failures.
