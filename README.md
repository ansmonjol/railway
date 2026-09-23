# Railway sandbox

A small dashboard that spins [`traefik/whoami`](https://github.com/traefik/whoami) containers up and down through [Railway's GraphQL API](https://docs.railway.com/reference/public-api).

## Run it

Requirements: [mise](https://mise.jdx.dev) (pins Node and pnpm).

```sh
mise install
pnpm install
cp .env.example .env   # fill it in, or use `railway run pnpm dev` with the Railway CLI
pnpm dev               # http://localhost:3000
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Production: `pnpm build && pnpm start`.

## Stack

TanStack Start in SPA mode (React 19, TanStack Router, Vite), TanStack Query, shadcn/ui on Base UI, gql.tada. The server functions are the only boundary between the browser and Railway.
