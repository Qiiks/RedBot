# @redbot/bot-gateway

Discord bot runtime (commands, events, moderation, automod, music client).

## Core Responsibilities

- Slash command routing + middleware (rate limit, RBAC)
- Moderation (`/warn`) and automod-lite message checks
- Role restoration on member join
- Audit event emission + critical alert hooks
- Lavalink/Shoukaku node connectivity

## Commands

```bash
pnpm --filter @redbot/bot-gateway dev
pnpm --filter @redbot/bot-gateway start
pnpm --filter @redbot/bot-gateway typecheck
```

## Key Env Vars

- `DISCORD_BOT_TOKEN`
- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `LAVALINK_NODE_NAME`, `LAVALINK_NODE_URL`, `LAVALINK_NODE_AUTH`
- `CRITICAL_ALERT_WEBHOOK_URL`

See `/docs/environment-variables.md` for value sources.
