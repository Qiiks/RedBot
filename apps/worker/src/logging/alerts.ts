import { createLogger } from "@redbot/shared";

const logger = createLogger({ service: "worker" });

function getWebhookUrl(): string | null {
  const url = process.env.CRITICAL_ALERT_WEBHOOK_URL;
  return url && url.trim().length > 0 ? url.trim() : null;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export async function sendCriticalAlert(title: string, details: string): Promise<void> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        content: `🚨 **${title}**\n${details}`
      })
    });

    if (!response.ok) {
      logger.error("Failed to send critical alert", {
        status: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    logger.error("Critical alert dispatch failed", {
      error
    });
  }
}

export function registerProcessAlertHandlers(serviceName: string): void {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { serviceName, error });
    void sendCriticalAlert(`uncaughtException (${serviceName})`, formatError(error));
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { serviceName, reason });
    void sendCriticalAlert(`unhandledRejection (${serviceName})`, formatError(reason));
  });
}
