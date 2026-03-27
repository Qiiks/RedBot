# @redbot/db

Prisma schema/client package for RedBot.

## Responsibilities

- Prisma schema source of truth
- Prisma client generation
- Migration commands (dev/deploy)

## Commands

```bash
pnpm --filter @redbot/db prisma:generate
pnpm --filter @redbot/db prisma:migrate:dev
pnpm --filter @redbot/db prisma:migrate:deploy
pnpm --filter @redbot/db typecheck
```

## Required Env Vars

- `DATABASE_URL`
- `NODE_ENV` (runtime behavior in singleton client)

See `/docs/environment-variables.md`.
