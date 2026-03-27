type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMetadata = Record<string, unknown>;

type LoggerContext = {
  service: string;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function asErrorObject(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function serializeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.entries(metadata).reduce<LogMetadata>((acc, [key, value]) => {
    if (value instanceof Error) {
      acc[key] = asErrorObject(value);
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
}

function formatPretty(level: LogLevel, service: string, message: string, metadata?: LogMetadata): string {
  const base = `[${new Date().toISOString()}] [${service}] [${level.toUpperCase()}] ${message}`;
  if (!metadata || Object.keys(metadata).length === 0) {
    return base;
  }

  return `${base} ${JSON.stringify(metadata)}`;
}

export function createLogger(context: LoggerContext) {
  const log = (level: LogLevel, message: string, metadata?: LogMetadata): void => {
    const normalizedMetadata = serializeMetadata(metadata);

    if (isProduction()) {
      const payload = {
        timestamp: new Date().toISOString(),
        level,
        service: context.service,
        message,
        ...(normalizedMetadata ? { metadata: normalizedMetadata } : {})
      };

      const json = JSON.stringify(payload);
      if (level === "error" || level === "warn") {
        process.stderr.write(`${json}\n`);
      } else {
        process.stdout.write(`${json}\n`);
      }

      return;
    }

    const pretty = formatPretty(level, context.service, message, normalizedMetadata);
    if (level === "error" || level === "warn") {
      process.stderr.write(`${pretty}\n`);
      return;
    }

    process.stdout.write(`${pretty}\n`);
  };

  return {
    debug: (message: string, metadata?: LogMetadata) => log("debug", message, metadata),
    info: (message: string, metadata?: LogMetadata) => log("info", message, metadata),
    warn: (message: string, metadata?: LogMetadata) => log("warn", message, metadata),
    error: (message: string, metadata?: LogMetadata) => log("error", message, metadata)
  };
}
