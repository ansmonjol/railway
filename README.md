# Railway sandbox

A small dashboard that spins [`traefik/whoami`](https://github.com/traefik/whoami) containers up and down through [Railway's GraphQL API](https://docs.railway.com/reference/public-api).

Live: https://dashboard-production-41c9.up.railway.app (access code on request)

## What it does

- **Sign in** with a shared access code. You get a random persona (Otter, Heron, Lynx...) that is recorded on everything you spin up.
- **Instances**: one row per service in the sandbox with its status, name, URL, who spun it up and when. The list polls every 3 s while something is starting or stopping, every 15 s otherwise.
- **Spin up** a whoami container with a generated name (`whoami-calm-otter`) or a custom one, each with its own public URL.
- **Stop, start, restart, destroy** from each row. A row shows Pending while its call is in flight; failures show a toast with Railway's trace ID.
- **A drawer per instance** (`?instance=<id>`, so it can be linked): overview, the last 200 log lines, deployments, and CPU and memory over the last hour.

## Run it

Requirements: [mise](https://mise.jdx.dev) (pins Node and pnpm) and, for real data, a Railway project token.

```sh
mise install && pnpm install
cp .env.example .env    # fill it in, or skip it and use the Railway CLI below
pnpm dev                # http://localhost:3000
railway run --service dashboard -- pnpm dev   # same, with the deployed service's variables
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Production build: `pnpm build && pnpm start`. On every pull request and push to `main`, [CI](.github/workflows/ci.yml) runs the checks plus `pnpm exec gql.tada check` and `pnpm format:check`, and [Build](.github/workflows/build.yml) runs `pnpm build`.

Deploying: the `dashboard` service is declared in `.railway/railway.ts` and builds from `main` on every merge, once CI and Build pass on that commit. `railway config plan` / `railway config apply` change its settings; secrets are set once with `railway variable set --stdin`.

## Architecture

```
Browser (SPA)                      Node server (srvx)                        Railway
src/routes, src/components         src/functions.ts: server functions        backboard.railway.com
TanStack Query polls  ---- RPC --> auth, validation, rules, 2 s cache  -----> /graphql/v2
                      <-- Result --  src/server/railway.ts    fetch wrapper
                                     src/server/operations.ts gql.tada documents
                                     src/server/snapshot.ts   response -> Snapshot (pure)
                                     src/server/session.ts    signed cookie (pure)
```

- **Reads** are one GraphQL request: every service instance in the environment with its latest deployment and domain, plus the environment config for `SPINNED_BY` / `SPINNED_AT`. `snapshot.ts` turns it into rows with a status and the actions allowed in that status. The server caches it for 2 s and shares it between concurrent requests, so several open tabs cost one Railway call.
- **Writes**: spin up is `serviceCreate` (image and `SPINNED_*` variables), then `serviceDomainCreate` (port 80), then `serviceInstanceDeployV2`, since creating a service never deploys it. Stop is `deploymentRemove`, start is `serviceInstanceDeployV2`, restart is `deploymentRestart`, destroy is `serviceDelete` scoped to the environment.

## Decisions

- **One boundary.** The browser never talks to Railway: every call goes through a TanStack Start server function holding the token. No GraphQL proxy, no token in the client. Server functions only answer same-origin requests (TanStack's CSRF middleware, on top of a `SameSite=Lax` cookie).
- **Results, not exceptions.** Server functions return `{ ok: true, data } | { ok: false, message, traceId? }`. The client unwraps them into TanStack Query errors, and one place (`router.tsx`) turns failures into toasts or, for an expired session, a trip back to the login screen.
- **Rules live on the server.** The slot cap (`SANDBOX_MAX_SERVICES` minus current rows), `SPINNED_BY` / `SPINNED_AT` taken from the session cookie rather than the request, the actions allowed per status, and the dashboard's own service (`RAILWAY_SERVICE_ID`), which is hidden and can never be targeted.
- **Status mapping.** Queued, initializing, building, deploying, waiting and needs approval are _starting_; success is _running_; sleeping is _sleeping_; removing is _stopping_; removed, or no deployment on a service that has deployed before, is _stopped_; failed and crashed are _failed_; anything else is _unknown_. The map is typed against the schema's enum, so a new Railway status fails the build after a schema refresh.
- **Stop removes the deployment.** `deploymentStop` leaves the status at SUCCESS, and `serviceInstanceRedeploy` does nothing once no deployment exists, hence `deploymentRemove` to stop and `serviceInstanceDeployV2` to start.
- **Destroy is scoped to the environment.** A project token gets "Not Authorized" on a project-wide `serviceDelete`, so the call passes `environmentId`; Railway then removes the service once no environment holds it.
- **Railway is slow to answer and slower to settle.** `serviceInstanceDeployV2` and `serviceDelete` sometimes take 15 to 20 s (the fetch timeout is 30 s), and a destroyed service stays listed for about ten seconds while Railway removes its domain, then its deployment, then the service. So the list polls every 3 s for 20 s after any write, a row stays Pending until the list reflects its call, and the server remembers what it is destroying so the row reads Destroying instead of Stopped with a Start button.
- **One project.** The dashboard manages the project it runs in, and its infrastructure file is a named partial, so `railway config apply` never treats runtime instances as drift. The trade-off: reading `SPINNED_*` needs `config(decryptVariables: true)`, which also returns the dashboard's own secrets to the server. They never leave the snapshot derivation; a separate sandbox project would remove the question (the `SANDBOX_*` variables already allow it).
- **Rate limits.** Railway allows 1000 requests per hour per token. At 15 s the list costs about 240 per hour per open tab (tabs share the cache), logs cost 720 per hour but only while the Logs tab is open and visible. A 429 starts a cool-down that honors `Retry-After` instead of hammering the API.
- **SPA, no SSR.** SPA mode prerenders the shell at build time, and `defaultSsr: false` keeps the Node server from rendering routes at runtime too.
- **Typed GraphQL without codegen.** gql.tada types every document against a checked-in schema snapshot (`pnpm schema` refreshes it), and `gql.tada check` validates them.
- **Two small charts, not a dual axis.** vCPU and MB share nothing but time, so they get two charts on the same one-hour axis. Recharts loads only with the Metrics tab.
- **Tests cover the pure parts**: status mapping, snapshot derivation, session signing, names. Nothing in the tests touches the real API.

## Extensions

What I would do next, roughly in order:

- **Two projects**: the dashboard in its own project and the instances in a sandbox project. The sandbox token would then never decrypt the dashboard's secrets, and the dashboard would not need to hide itself. The code already reads the sandbox from `SANDBOX_*`; the move is a second project token and the trial's second project slot.
- **Push instead of poll**: Railway's GraphQL subscriptions for deployment status and logs, relayed over SSE.
- **Slot reservation**: two simultaneous spin-ups can both pass the cap check (Railway's own per-project limit still holds). A lock or a reservation row would close it.
- **Clean up half-created instances** when the domain or the deploy fails after `serviceCreate`. Today they show up as _unknown_ with Start and Destroy.
- **Real identities**: OAuth or magic links instead of a shared code and a random persona, plus an audit log of who did what.
- **Rename**: needs an account token, since a project token gets "Not Authorized" on `serviceUpdate`.
- **More sources**: any image or repository, per-instance variables and ports.
- **Sandbox-wide pages**: usage and cost across instances, a command palette.
- **More CI**: `railway config plan` on every pull request, which needs a Railway token as a repository secret; end-to-end tests against a disposable Railway environment.
