# RedBot Monorepo

Discord bot + web dashboard + worker, built as a pnpm/Turborepo monorepo.

## Services

- `apps/web` — Next.js dashboard (Discord OAuth via Auth.js)
- `apps/bot-gateway` — discord.js runtime (commands/events/automod/music)
- `apps/worker` — BullMQ background processor for timed actions
- `packages/db` — Prisma schema/client and migrations
- `packages/shared` — shared structured logger and common utilities

## Infrastructure

- PostgreSQL
- Redis
- Lavalink

Local infra compose file:

- `docker-compose.yml` (postgres + redis + lavalink)

Coolify app-tier compose file:

- `docker-compose.coolify-app.yml` (web + bot-gateway + worker)

## Quick Start (Local)

1. Start infra:

```bash
docker compose up -d
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
pnpm install
```

4. Generate Prisma client:

```bash
pnpm --filter @redbot/db prisma:generate
```

5. Run typecheck:

```bash
pnpm typecheck
```

6. Start development:

```bash
pnpm dev
```

## Environment Variables

- Canonical template: `/.env.example`
- Full acquisition guide: `/docs/environment-variables.md`

Service-level docs:

- `/apps/web/README.md`
- `/apps/bot-gateway/README.md`
- `/apps/worker/README.md`
- `/packages/db/README.md`
- `/packages/shared/README.md`

## Deployment (Coolify)

- Runbook: `/docs/coolify-deployment.md`
- Includes two patterns:
  - Single app-tier compose deployment
  - Separate per-service deployment

## Database Migrations (Prod)

Release-blocking migration command:

```bash
pnpm deploy:db
```
