import { db } from "@redbot/db";
import Redis from "ioredis";

export type DiscordPermissionCheck = () => boolean | Promise<boolean>;

export type RbacEvaluationInput = {
  guildId: string;
  userId: string;
  roleIds: string[];
  command: string;
  checkDiscordPermission: DiscordPermissionCheck;
};

export type RbacDecisionSource =
  | "USER_DENY"
  | "ROLE_DENY"
  | "USER_ALLOW"
  | "ROLE_ALLOW"
  | "DISCORD_NATIVE";

export type RbacEvaluationResult = {
  allowed: boolean;
  source: RbacDecisionSource;
};

const DEFAULT_TTL_SECONDS = 60;

const redis = new Redis({
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true
});

function normalizeRoleIds(roleIds: string[]): string[] {
  return [...new Set(roleIds)].sort();
}

function cacheKey(input: Pick<RbacEvaluationInput, "guildId" | "userId" | "command">): string {
  return `rbac:${input.guildId}:${input.userId}:${input.command}`;
}

function isRbacResult(value: unknown): value is RbacEvaluationResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RbacEvaluationResult>;
  const validSource: RbacDecisionSource[] = [
    "USER_DENY",
    "ROLE_DENY",
    "USER_ALLOW",
    "ROLE_ALLOW",
    "DISCORD_NATIVE"
  ];

  return typeof candidate.allowed === "boolean" && !!candidate.source && validSource.includes(candidate.source);
}

async function evaluateOverrides(input: RbacEvaluationInput): Promise<RbacEvaluationResult | null> {
  const roleIds = normalizeRoleIds(input.roleIds);

  const overrides = await db.permissionOverride.findMany({
    where: {
      guildId: input.guildId,
      command: input.command,
      OR: [
        {
          subjectType: "USER",
          subjectId: input.userId
        },
        roleIds.length
          ? {
              subjectType: "ROLE",
              subjectId: {
                in: roleIds
              }
            }
          : {
              subjectType: "ROLE",
              subjectId: "__NO_ROLE_MATCH__"
            }
      ]
    }
  });

  const userDeny = overrides.some((override) => override.subjectType === "USER" && !override.allow);
  if (userDeny) {
    return { allowed: false, source: "USER_DENY" };
  }

  const roleDeny = overrides.some((override) => override.subjectType === "ROLE" && !override.allow);
  if (roleDeny) {
    return { allowed: false, source: "ROLE_DENY" };
  }

  const userAllow = overrides.some((override) => override.subjectType === "USER" && override.allow);
  if (userAllow) {
    return { allowed: true, source: "USER_ALLOW" };
  }

  const roleAllow = overrides.some((override) => override.subjectType === "ROLE" && override.allow);
  if (roleAllow) {
    return { allowed: true, source: "ROLE_ALLOW" };
  }

  return null;
}

export async function evaluateCommandAccess(
  input: RbacEvaluationInput,
  options?: { ttlSeconds?: number }
): Promise<RbacEvaluationResult> {
  const key = cacheKey(input);

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown;
      if (isRbacResult(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Cache failures should never block authorization evaluation.
  }

  const overrideDecision = await evaluateOverrides(input);

  let decision: RbacEvaluationResult;
  if (overrideDecision) {
    decision = overrideDecision;
  } else {
    const discordAllowed = await input.checkDiscordPermission();
    decision = {
      allowed: discordAllowed,
      source: "DISCORD_NATIVE"
    };
  }

  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  try {
    await redis.set(key, JSON.stringify(decision), "EX", ttlSeconds);
  } catch {
    // Ignore cache write failures.
  }

  return decision;
}

export async function invalidateRbacCacheForUser(input: {
  guildId: string;
  userId: string;
  command?: string;
}): Promise<void> {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    if (input.command) {
      await redis.del(`rbac:${input.guildId}:${input.userId}:${input.command}`);
      return;
    }

    const keys = await redis.keys(`rbac:${input.guildId}:${input.userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Ignore cache invalidation failures.
  }
}
