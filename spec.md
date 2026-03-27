# Discord Bot + Web Dashboard — v1 Product & Technical Spec

Status: Draft for implementation  
Version: 1.0  
Date: 2026-03-27

## 1) Product Goal

Build a multi-guild Discord bot + web dashboard (CarlBot/Dyno-style) with strong moderation, configurable automations, and full music support in v1, while keeping infrastructure simple for an allowlisted early rollout.

## 2) v1 Scope

### In Scope (Must Ship)
- Dashboard auth/configuration
- Hybrid RBAC (Discord perms + bot overrides)
- Moderation core (warn/timeout/timed actions)
- Automod-lite (spam, invite, excessive caps)
- Audit logging + mod logging
- Welcome/leave
- Autorole
- Reaction roles (with exclusivity groups)
- Utility commands
- Music system (Lavalink-based)

### Out of Scope (Deferred)
- Tickets
- Leveling
- Giveaways
- Full parity extras beyond focused core
- Mandatory full observability stack (Prometheus/Grafana/Loki)
- Mandatory external error tracker (Sentry)
- Host-failure disaster recovery guarantees

## 3) Technology & Architecture

### Core Stack
- Backend: TypeScript + discord.js
- Dashboard/Web: Next.js + React
- API: Next.js Route Handlers + tRPC
- Database: PostgreSQL
- ORM/Migrations: Prisma (`prisma migrate deploy` is release-blocking)
- Cache/Queue: Redis + BullMQ
- Music: Lavalink + Shoukaku
- Monorepo tooling: pnpm + Turborepo

### Monorepo Service Topology
- `apps/bot-gateway`: Discord events, slash/context/prefix dispatch
- `apps/web`: dashboard UI + API/tRPC handlers
- `apps/worker`: timed jobs, background processors
- `packages/shared`: shared types, config, validation, constants
- `packages/db`: Prisma schema/client + migrations

### Deployment Topology (v1)
- Self-hosted single VPS via Coolify
- Isolated containers on same VPS for:
  - bot service
  - web/API service
  - worker service
  - PostgreSQL
  - Redis
  - Lavalink

### Environments & Release Flow
- Environments: Dev + Prod only
- Dev may auto-deploy
- Prod deploy is manual promotion of tested commit/tag
- Brief restarts are acceptable in v1

## 4) Multi-Tenancy, Isolation, and Onboarding

### Tenancy Model
- Shared PostgreSQL schema with tenant scoping by `guild_id`

### Isolation Enforcement
- Application query guards for every tenant-bound query
- DB constraints/indexing patterns to prevent cross-guild linkage
- No Postgres RLS in v1

### Guild Onboarding Lifecycle
- Multi-guild capable from day one
- Allowlist-only rollout in v1 (owner-approved guild IDs)
- On guild removal:
  - Soft-delete immediately
  - Hard purge after 30 days

## 5) Access Control & Command Model

### Dashboard Auth/Access
- Auth.js (NextAuth) with Discord OAuth provider
- Manager-only dashboard access (view/edit restricted)
- Mutation/edit permission baseline: Discord `Manage Guild`

### Command Surface
- Slash-first + context menus + legacy prefix support
- Prefix is per-guild configurable
- Slash/context registration scope: guild-scoped in v1
- If prefix commands unavailable (e.g., missing intent), bot replies with slash guidance

### Privileged Intents Policy
- Message Content intent required where prefix support is promised
- Guild Members intent required in v1 (no degraded mode for member-dependent modules)

## 6) RBAC Model

Hybrid permission model:
- Base: Discord native permissions
- Overlay: bot-level allow/deny overrides

Precedence order (highest first):
1. User deny
2. Role deny
3. User allow
4. Role allow
5. Discord permissions

Runtime evaluation:
- Read-through Redis cache with short TTL
- Event-bus invalidation/update on settings changes

## 7) Moderation & Timed Actions

### Warning System
- Warning history persisted in PostgreSQL
- Shared warning counter per `(guild_id, user_id)`
  - manual warnings and automod warnings both contribute
- Escalation is always automatic:
  - threshold: 3 warnings
  - action: 10-minute timeout
- Warning decay window: 7 days

### Automod-lite Defaults
- Enabled detections: spam, invite links, excessive caps
- Default action: delete message + warn user
- Exemptions: bots + members with mod/admin permissions
- Invite policy: allow own-guild invites, block external invites unless allowlisted

### Timed Moderation Engine
- Scheduling/execution: BullMQ on Redis
- Source-of-truth/ledger: PostgreSQL
- Execution precision target: best-effort ±60 seconds
- Recovery: auto-rehydrate pending timed jobs from PostgreSQL into BullMQ after restart

## 8) Role Persistence & Reaction Roles

### Role Persistence
- Persist all assignable roles except managed/system/non-assignable roles
- Restore immediately on member join
- Restore order: hierarchy-safe (lowest → highest)
- If role is no longer assignable or above bot role: skip permanently + log
- Duplicate suppression: idempotency window per guild+member

### Reaction Roles
- Support multiple emoji→role mappings per message
- Support exclusivity groups in v1

## 9) Logging, Snapshots, and Retention

### Canonical Logging Policy
- Metadata-first logging by default
- Message-content snapshots are opt-in only (guild-wide single toggle in v1)

### Snapshot Storage Policy
- No message-content snapshots stored in PostgreSQL
- When enabled, snapshots are channel-only (mod-log output)

### Log Channel Layout & Retention
- Default: unified single log channel with category-tagged entries
- Channel retention policy is guild-configurable
- Default retention behavior: keep forever
- Optional pruning mode:
  - Default TTL when enabled: 180 days
  - Prune scope: all messages older than TTL in the configured log channel
  - Mixed-channel safety: warn then allow (no hard block)

### Database Retention Default
- Audit/mod/event metadata retention default: 180 days

## 10) Music System Specification

- Playback infra: Lavalink + Shoukaku
- Source resolution policy:
  - Resolve metadata to playable sources
  - Fallback default order begins with YouTube
- Queue fairness:
  - Configurable per guild
  - Default for new guilds: round-robin by user
- Idle behavior: auto-disconnect after 5 minutes (guild-configurable)
- Outage behavior: graceful fail + user notification, preserve queue where possible, allow manual retry

## 11) Abuse Prevention & Rate Limiting

Redis token-bucket layers:
- Global
- Per guild
- Per user
- Command-specific cooldown overrides

User feedback:
- Default cooldown response is ephemeral with retry-after guidance

## 12) Scale Targets & Sharding Strategy

v1 planning target:
- Up to 50 guilds peak
- Up to 5 concurrent voice sessions

Gateway strategy:
- Single shard in v1
- Documented trigger thresholds and migration plan for auto-sharding later

## 13) Data Model Requirements (Prisma/Postgres)

All tenant-bound tables must include `guild_id` and use composite constraints to enforce guild isolation.

Minimum required domains/tables:
- `guilds` (guild identity, lifecycle/soft-delete status)
- `guild_settings` (feature flags, automod config, logging config, music defaults)
- `guild_prefixes` (custom prefix)
- `permission_overrides` (subject/user/role allow-deny entries)
- `warnings` (source, reason, moderator, created_at, expires_at)
- `timed_actions` (mute/timeout/etc state, schedule, status, execution metadata)
- `role_persistence_snapshots` (role IDs eligible for restore; no message content)
- `reaction_role_messages` / `reaction_role_mappings` / `reaction_role_groups`
- `audit_events` (metadata-only audit stream)
- `mod_actions` (moderation ledger)
- `rate_limit_policies` (guild overrides)
- `allowlisted_guilds` (onboarding control)

Constraint requirements:
- Composite uniqueness scoped by guild where applicable
- Composite foreign keys that include `guild_id` when linking tenant entities
- Index hot paths for permission checks, warnings lookup, timed-action due queries

## 14) Operations, Security, and Reliability

### Secrets & Config
- Store secrets in Coolify env vars
- Encrypted backups required

### Backup/Recovery
- Backup target: nightly encrypted backups
- RPO target: 24 hours
- Monthly backup drill: checksum verification only (no mandatory restore execution in v1)
- Host-failure DR is out of scope in v1 (no offsite backup requirement)

### Observability Baseline
- Structured JSON logs
- Service health checks
- Discord ops channel for alerts (critical-only by default)
- Optional future path (feature-flag/opt-in):
  - Prometheus/Grafana/Loki
  - Sentry or equivalent error tracker

## 15) API & Dashboard Behavior Requirements

- Dashboard operations must enforce manager-only access server-side
- All mutation endpoints must re-check guild-scoped permissions (never trust client)
- Config writes are persisted to PostgreSQL, then propagated through Redis invalidation/event bus for near-immediate bot runtime sync
- v1 UX should prioritize fast, explicit admin feedback on permission denial, cooldowns, and unavailable command paths

## 16) Implementation Plan (Execution Order)

### Phase 0 — Foundation
- Initialize monorepo (pnpm + Turborepo)
- Set up shared config/env validation
- Bootstrap Prisma schema + migration pipeline
- Provision local/dev compose equivalents for Postgres/Redis/Lavalink

### Phase 1 — Core Runtime Skeleton
- Build bot gateway command/event framework
- Build web app skeleton + Auth.js Discord login
- Build worker service scaffold with BullMQ
- Add shared logging + health endpoints

### Phase 2 — Tenancy/RBAC/Permissions
- Implement allowlist guild onboarding
- Enforce `guild_id` query guards and DB constraints
- Implement hybrid RBAC with precedence and Redis cache/invalidation

### Phase 3 — Moderation Core
- Implement warnings model (shared counter, decay, auto-escalation)
- Implement automod-lite defaults and exemptions
- Implement timed actions with Postgres ledger + BullMQ scheduling + recovery

### Phase 4 — Role Systems
- Implement autorole and role persistence (ordered restore + idempotency)
- Implement reaction roles with exclusivity groups

### Phase 5 — Logging/Audit
- Implement metadata-first audit/mod logs
- Add opt-in channel-only content snapshots
- Implement configurable channel retention/pruning flow

### Phase 6 — Music
- Integrate Lavalink/Shoukaku playback flow
- Implement metadata resolution and fallback chain (YouTube-first)
- Implement fairness modes (default round-robin), idle disconnect, outage handling

### Phase 7 — Dashboard Feature Completion
- Build manager-only settings pages for all v1 modules
- Add validation, safe defaults, and publish/apply flows with Redis propagation

### Phase 8 — Hardening & Production Readiness
- Add layered rate limiting and cooldown UX
- Finalize deploy pipeline (manual prod promotion + blocking migrations)
- Add backup automation + monthly checksum drill procedure
- Finalize runbooks and critical-only Discord alert routing

## 17) v1 Acceptance Criteria

- All in-scope modules are usable from both Discord and dashboard where applicable
- Tenant isolation holds under automated tests and schema constraints
- RBAC precedence is enforced exactly as specified
- Warning escalation and timed moderation recover correctly across restarts
- Role persistence restores safely without hierarchy violations or duplicate spam
- Logging policy matches metadata-default + opt-in snapshots (channel-only)
- Music features meet configured defaults and graceful failure expectations
- Deployment succeeds only when migrations succeed
- Ops baseline (health checks, JSON logs, critical alerts, encrypted nightly backups) is operational
