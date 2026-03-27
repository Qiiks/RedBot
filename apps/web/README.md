# @redbot/web

Next.js dashboard for guild management and auth.

## Core Responsibilities

- Discord OAuth login (Auth.js)
- Manager-only guild settings UI
- Server-side settings writes + Redis config-update publish

## Commands

```bash
pnpm --filter @redbot/web dev
pnpm --filter @redbot/web build
pnpm --filter @redbot/web typecheck
```

## Key Env Vars

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`
- `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`

See `/docs/environment-variables.md` for value sources.
