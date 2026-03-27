import Redis from "ioredis";
import { getRedisConnectionConfig } from "@redbot/shared";

type RateLimitLayer = "GUILD" | "USER";

type BucketPolicy = {
  capacity: number;
  refillPerSecond: number;
};

type ConsumeBucketResult = {
  allowed: boolean;
  retryAfterMs: number;
};

export type RateLimitInput = {
  guildId: string;
  userId: string;
  command: string;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
  layer?: RateLimitLayer;
};

const redis = new Redis({
  ...getRedisConnectionConfig(),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true
});

const DEFAULT_GUILD_POLICY: BucketPolicy = {
  capacity: 30,
  refillPerSecond: 10
};

const DEFAULT_USER_POLICY: BucketPolicy = {
  capacity: 6,
  refillPerSecond: 2
};

const COMMAND_OVERRIDES: Record<string, Partial<Record<RateLimitLayer, BucketPolicy>>> = {
  warn: {
    GUILD: { capacity: 10, refillPerSecond: 3 },
    USER: { capacity: 2, refillPerSecond: 0.5 }
  }
};

const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillPerMs = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "lastRefillMs")
local tokens = tonumber(data[1])
local lastRefillMs = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  lastRefillMs = nowMs
end

local elapsed = math.max(0, nowMs - lastRefillMs)
local refilled = math.min(capacity, tokens + (elapsed * refillPerMs))

local allowed = 0
local retryAfterMs = 0

if refilled >= 1 then
  allowed = 1
  refilled = refilled - 1
else
  retryAfterMs = math.ceil((1 - refilled) / refillPerMs)
end

redis.call("HMSET", key, "tokens", refilled, "lastRefillMs", nowMs)
redis.call("PEXPIRE", key, ttlMs)

return { allowed, retryAfterMs }
`;

function resolvePolicy(command: string, layer: RateLimitLayer): BucketPolicy {
  const override = COMMAND_OVERRIDES[command]?.[layer];
  if (override) {
    return override;
  }

  return layer === "GUILD" ? DEFAULT_GUILD_POLICY : DEFAULT_USER_POLICY;
}

function bucketKey(input: RateLimitInput, layer: RateLimitLayer): string {
  if (layer === "GUILD") {
    return `rate-limit:guild:${input.guildId}`;
  }

  return `rate-limit:user:${input.userId}`;
}

function ttlMsFromPolicy(policy: BucketPolicy): number {
  const refillToFullSeconds = policy.capacity / policy.refillPerSecond;
  return Math.ceil(refillToFullSeconds * 1000) + 60_000;
}

async function consumeBucket(
  key: string,
  policy: BucketPolicy,
  nowMs: number
): Promise<ConsumeBucketResult> {
  const refillPerMs = policy.refillPerSecond / 1000;
  const ttlMs = ttlMsFromPolicy(policy);

  const rawResult = (await redis.eval(TOKEN_BUCKET_LUA, 1, key, nowMs, policy.capacity, refillPerMs, ttlMs)) as [
    number,
    number
  ];

  return {
    allowed: rawResult[0] === 1,
    retryAfterMs: Math.max(0, Number(rawResult[1] ?? 0))
  };
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  if (redis.status === "wait") {
    await redis.connect();
  }

  const nowMs = Date.now();

  const guildPolicy = resolvePolicy(input.command, "GUILD");
  const guildResult = await consumeBucket(bucketKey(input, "GUILD"), guildPolicy, nowMs);
  if (!guildResult.allowed) {
    return {
      allowed: false,
      retryAfterMs: guildResult.retryAfterMs,
      layer: "GUILD"
    };
  }

  const userPolicy = resolvePolicy(input.command, "USER");
  const userResult = await consumeBucket(bucketKey(input, "USER"), userPolicy, nowMs);
  if (!userResult.allowed) {
    return {
      allowed: false,
      retryAfterMs: userResult.retryAfterMs,
      layer: "USER"
    };
  }

  return {
    allowed: true,
    retryAfterMs: 0
  };
}
