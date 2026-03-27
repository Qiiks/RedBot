export type RedisConnectionConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDb(pathname: string): number | undefined {
  const normalized = pathname.replace(/^\//, "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export function getRedisConnectionConfig(env: NodeJS.ProcessEnv = process.env): RedisConnectionConfig {
  const redisUrl = env.REDIS_URL?.trim();
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      throw new Error("REDIS_URL must use redis:// or rediss:// protocol");
    }

    return {
      host: parsed.hostname,
      port: parsePort(parsed.port, 6379),
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(parseDb(parsed.pathname) !== undefined ? { db: parseDb(parsed.pathname) } : {}),
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {})
    };
  }

  return {
    host: env.REDIS_HOST ?? "127.0.0.1",
    port: parsePort(env.REDIS_PORT, 6379)
  };
}
