# Railway sandbox

A dashboard that spins `traefik/whoami` containers up and down through Railway's GraphQL API. The README has the architecture and the decisions.

## Commands

- `pnpm dev`: dev server on http://localhost:3000 (`railway run pnpm dev` injects the deployed service's variables)
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format`
- `pnpm build && pnpm start`: production build served by srvx, as on Railway
- `railway config plan` / `railway config apply`: preview and apply `.railway/railway.ts`, the dashboard service's infrastructure (secrets stay `preserve()`, set with `railway variable set --stdin`)

Done means what CI runs is green locally, shown with its output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm exec gql.tada check`, `pnpm format:check` (`ci.yml`) and `pnpm build` (`build.yml`).

## Rules

- pnpm only. Node and pnpm are pinned in `mise.toml`.
- Never write an em dash or an en dash anywhere (code, docs, commits): use a hyphen, a colon or a rewrite.
- Conventional Commits for commit subjects and PR titles (`feat(instances): ...`). No Co-Authored-By lines and no mention of AI assistance in commits or PRs.
- Work on a feature branch and land it through a squash-merged PR.
- The browser never calls Railway. Every Railway call runs in a server function in `src/functions.ts`, and each one returns `{ ok: true, data } | { ok: false, message, traceId? }` instead of throwing.
- The rules live on the server: the slot cap, `SPINNED_BY` / `SPINNED_AT` taken from the session cookie, and the refusal to touch excluded services.
- Tests cover pure functions only and never touch the real API.
- Secrets live only in the environment (see `.env.example`). Never create or delete Railway resources without asking first.
