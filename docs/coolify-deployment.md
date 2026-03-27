# Coolify Deployment Runbook — RedBot Monorepo

This runbook deploys the current monorepo architecture to Coolify with separate services:

- PostgreSQL
- Redis
- Lavalink
- Web (`apps/web`)
- Bot Gateway (`apps/bot-gateway`)
- Worker (`apps/worker`)

---

## 0) Prerequisites

1. Coolify project created and connected to this Git repository.
2. Domain names decided (example):
   - `dashboard.example.com` (web)
3. Discord application configured:
   - Bot token created.
   - OAuth redirect set to:
     - `https://dashboard.example.com/api/auth/callback/discord`
4. Root `.env.example` reviewed and values prepared.

---

## 1) Provision Data Services in Coolify

### 1.1 PostgreSQL

1. Create **PostgreSQL** service in Coolify.
2. Set database/user/password.
3. Save internal connection string for app services:

```env
DATABASE_URL=postgresql://<user>:<password>@<postgres-service-name>:5432/<database>
```

4. Enable persistent volume/backups in Coolify.

### 1.2 Redis

1. Create **Redis** service in Coolify.
2. Keep internal network-only access.
3. Record:

```env
REDIS_HOST=<redis-service-name>
REDIS_PORT=6379
```

---

## 2) Deploy Lavalink (Generic Docker Service)

Create a **Docker service** (generic) for Lavalink.

### Recommended image

- `ghcr.io/lavalink-devs/lavalink:4`

### Ports

- Internal: `2333`
- External exposure optional (usually internal-only for bot).

### Environment

Set at minimum:

```env
SERVER_PORT=2333
LAVALINK_SERVER_PASSWORD=<same-as-LAVALINK_NODE_AUTH>
```

Optional JVM limits:

```env
_JAVA_OPTIONS=-Xms256M -Xmx512M
```

### Health expectation

Bot must reach `http://<lavalink-service-name>:2333` internally.

---

## 3) Deploy Application Services (Monorepo per-service)

Create **three separate services** from the same repository/branch.

## 3.1 Web Service (`apps/web`)

- Build type: **Dockerfile**
- Dockerfile path: `apps/web/Dockerfile`
- Domain: `dashboard.example.com`
- Port: `3000`

Required env:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=<redis-service-name>
REDIS_PORT=6379
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
AUTH_SECRET=...
AUTH_URL=https://dashboard.example.com
AUTH_TRUST_HOST=true
```

## 3.2 Bot Gateway Service (`apps/bot-gateway`)

- Build type: **Dockerfile**
- Dockerfile path: `apps/bot-gateway/Dockerfile`
- No public domain required.

Required env:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=<redis-service-name>
REDIS_PORT=6379
DISCORD_BOT_TOKEN=...
LAVALINK_NODE_NAME=local
LAVALINK_NODE_URL=<lavalink-service-name>:2333
LAVALINK_NODE_AUTH=...
CRITICAL_ALERT_WEBHOOK_URL=...
```

## 3.3 Worker Service (`apps/worker`)

- Build type: **Dockerfile**
- Dockerfile path: `apps/worker/Dockerfile`
- No public domain required.

Required env:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=<redis-service-name>
REDIS_PORT=6379
CRITICAL_ALERT_WEBHOOK_URL=...
```

---

## 4) Run Database Migrations (Release-Blocking)

Before promoting/restarting all services, run migration deploy:

```bash
pnpm deploy:db
```

This executes:

```bash
pnpm --filter @redbot/db prisma:migrate:deploy
```

Policy: deploy is blocked until migrations succeed.

---

## 5) Deployment Order

1. PostgreSQL up and healthy.
2. Redis up and healthy.
3. Lavalink up and healthy.
4. Run DB migrations (`pnpm deploy:db`).
5. Deploy/update web.
6. Deploy/update bot gateway.
7. Deploy/update worker.

---

## 6) Post-Deploy Validation Checklist

### Web

- [ ] `https://dashboard.example.com` loads.
- [ ] Discord sign-in works.
- [ ] Dashboard guild settings page loads and saves.

### Bot

- [ ] Bot appears online in Discord.
- [ ] Slash command `/warn` works.
- [ ] Rate-limit + RBAC responses still function.
- [ ] Automod triggers on test invite/caps/spam cases.

### Worker

- [ ] Worker starts with no connection errors.
- [ ] Timed actions transition PENDING → COMPLETED/FAILED correctly.

### Logging/Alerts

- [ ] Structured logs visible in Coolify logs for all services.
- [ ] Test `CRITICAL_ALERT_WEBHOOK_URL` by forcing a handled failure.

### Music

- [ ] Bot connects to Lavalink node (ready log appears).

---

## 7) Common Failure Modes

1. **Auth callback mismatch**
   - Fix Discord OAuth redirect URL to exact production callback.

2. **Prisma connection failures**
   - Validate `DATABASE_URL` uses internal service hostname, not localhost.

3. **Redis connection failures**
   - Ensure `REDIS_HOST` is Coolify Redis service name.

4. **Lavalink auth failure**
   - Ensure `LAVALINK_NODE_AUTH` matches Lavalink server password exactly.

5. **Bot not receiving messages for automod**
   - Confirm bot has Message Content intent enabled in Discord Developer Portal.

---

## 8) Recommended Coolify Operational Defaults

- Enable restart policy for all services.
- Use persistent volumes for PostgreSQL.
- Keep Redis and Lavalink internal-only unless explicitly needed.
- Use branch/tag-based manual promotion for production releases.
- Keep `CRITICAL_ALERT_WEBHOOK_URL` configured for bot + worker.
