# @redbot/worker

Background worker for timed moderation actions using BullMQ + Redis.

## Core Responsibilities

- Process delayed timed-action jobs
- Update timed-action status in PostgreSQL
- Emit structured logs + critical alert hooks

## Commands

```bash
pnpm --filter @redbot/worker dev
pnpm --filter @redbot/worker start
pnpm --filter @redbot/worker typecheck
```

## Key Env Vars

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `CRITICAL_ALERT_WEBHOOK_URL`

See `/docs/environment-variables.md` for value sources.
