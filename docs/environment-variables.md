# Environment Variables Guide

This guide explains every variable, where it is used, and exactly where to get its value.

Canonical template: `/.env.example`

---

## Copy/Paste Source Matrix

Use this table when filling Coolify env vars.

| Variable | Exact source | Where to paste |
|---|---|---|
| `NODE_ENV` | Static value `production` | Web, Bot, Worker |
| `DATABASE_URL` | Coolify PostgreSQL service credentials/internal URL | Web, Bot, Worker |
| `REDIS_HOST` | Coolify Redis service hostname | Web, Bot, Worker |
| `REDIS_PORT` | Coolify Redis port (`6379` by default) | Web, Bot, Worker |
| `DISCORD_BOT_TOKEN` | Discord Developer Portal → App → **Bot** → Token | Bot |
| `AUTH_DISCORD_ID` | Discord Developer Portal → App → **OAuth2** → Client ID | Web |
| `AUTH_DISCORD_SECRET` | Discord Developer Portal → App → **OAuth2** → Client Secret | Web |
| `AUTH_SECRET` | Generate locally (`openssl rand -base64 32`) | Web |
| `AUTH_URL` | Your public dashboard URL (e.g. `https://dashboard.example.com`) | Web |
| `AUTH_TRUST_HOST` | Static value `true` (behind Coolify proxy) | Web |
| `LAVALINK_NODE_NAME` | Static label (e.g. `local`) | Bot |
| `LAVALINK_NODE_URL` | Coolify Lavalink internal host:port (`service-name:2333`) | Bot |
| `LAVALINK_NODE_AUTH` | Lavalink service password (`LAVALINK_SERVER_PASSWORD`) | Bot |
| `CRITICAL_ALERT_WEBHOOK_URL` | Discord channel webhook URL | Bot, Worker |

---

## 1) Required Variables (Production)

## Global Runtime

### `NODE_ENV`
- **Used by:** all services (logging/runtime behavior)
- **Set to:** `production` in Coolify

## Database

### `DATABASE_URL`
- **Used by:** Prisma (`packages/db`) and all services through `@redbot/db`
- **Format:** `postgresql://USER:PASSWORD@HOST:5432/DB`
- **Get it from:** Coolify PostgreSQL service credentials/internal connection info

## Redis

### `REDIS_HOST`
### `REDIS_PORT`
- **Used by:** web server actions, bot, worker (cache/queue/event bus)
- **Get it from:** Coolify Redis service hostname + port (`6379` by default)

## Discord Bot

### `DISCORD_BOT_TOKEN`
- **Used by:** `apps/bot-gateway`
- **Get it from:** Discord Developer Portal → Application → **Bot** → Token

## Discord OAuth (Dashboard Auth)

### `AUTH_DISCORD_ID`
### `AUTH_DISCORD_SECRET`
- **Used by:** `apps/web` Auth.js Discord provider
- **Get from:** Discord Developer Portal → Application → **OAuth2**
- **What `AUTH_DISCORD_ID` is:** OAuth **Client ID** of your Discord application.
- **What it is NOT:**
  - not your bot token
  - not a Discord user ID
  - not a guild/server ID

### Exact click path (Discord)

1. Open: https://discord.com/developers/applications
2. Select your application.
3. Left sidebar → **OAuth2**.
4. Copy:
   - **Client ID** → `AUTH_DISCORD_ID`
   - **Client Secret** → `AUTH_DISCORD_SECRET`

### `AUTH_SECRET`
- **Used by:** Auth.js session/cookie signing
- **Generate with:**

```bash
openssl rand -base64 32
```

### `AUTH_URL`
- **Used by:** Auth.js callback URL generation
- **Set to:** your public dashboard URL (e.g., `https://dashboard.example.com`)
- **Must match:** the real domain serving `apps/web` in Coolify

### `AUTH_TRUST_HOST`
- **Used by:** Auth.js behind reverse proxy
- **Set to:** `true` on Coolify

## Lavalink

### `LAVALINK_NODE_NAME`
### `LAVALINK_NODE_URL`
### `LAVALINK_NODE_AUTH`
- **Used by:** bot music client (Shoukaku)
- **Get from:** your Lavalink service config
- **Important:** `LAVALINK_NODE_AUTH` must match Lavalink server password exactly

### `LAVALINK_NODE_SECURE`
- **Used by:** bot music client (Shoukaku node TLS mode)
- **Set to:** `true` when provider says SSL/Secure is enabled (typically port 443), otherwise `false`

## Alerts

### `CRITICAL_ALERT_WEBHOOK_URL`
- **Used by:** bot + worker critical alert handlers
- **Get from:** Discord channel → Integrations → Webhooks

---

## 2) Optional Variables

### `REDIS_URL`
- Optional convenience value for future tooling; current code uses host/port.

### `OPS_ALERT_CHANNEL_ID`
- Reserved for future ops routing.

### `LAVALINK_JAVA_XMS`, `LAVALINK_JAVA_XMX`
- Optional JVM sizing hints for Lavalink service config.

### `WORKER_CONCURRENCY`
- Reserved for future worker tuning.

---

## 3) Discord Setup Checklist (Where People Usually Get Stuck)

1. Create app in Discord Developer Portal.
2. In **Bot** tab:
   - create bot user
   - copy token → `DISCORD_BOT_TOKEN`
3. In **OAuth2** tab:
   - copy Client ID → `AUTH_DISCORD_ID`
   - copy Client Secret → `AUTH_DISCORD_SECRET`
4. Add redirect URL:

```text
https://dashboard.example.com/api/auth/callback/discord
```

5. In **Bot → Privileged Gateway Intents**, enable intents required by your bot features (notably message/member intents for automod/member flows).

### Quick sanity test

- If login page says Discord OAuth misconfigured, check `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` first.
- If login redirects incorrectly, check `AUTH_URL` and callback URL in Discord match exactly.

---

## 4) Coolify Mapping (Recommended)

If using one app-tier compose (`docker-compose.coolify-app.yml`), set env vars once at the compose app level.

Typical values:

```env
NODE_ENV=production
DATABASE_URL=postgresql://redbot:***@postgres:5432/redbot
REDIS_HOST=redis
REDIS_PORT=6379
AUTH_URL=https://dashboard.example.com
AUTH_TRUST_HOST=true
LAVALINK_NODE_NAME=local
LAVALINK_NODE_URL=lavalink:2333
```

---

## 5) Validation Commands

Before deploy:

```bash
pnpm install
pnpm --filter @redbot/db prisma:generate
pnpm typecheck
```

For production migration step:

```bash
pnpm deploy:db
```
