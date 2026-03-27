import { db } from "@redbot/db";
import { createLogger } from "@redbot/shared";
import { Worker } from "bullmq";
import { registerProcessAlertHandlers, sendCriticalAlert } from "./logging/alerts";

const logger = createLogger({ service: "worker" });

type TimedActionJobData = {
  timedActionId: string;
  guildId: string;
  userId: string;
  actionType: "TIMEOUT" | "BAN";
};

const connection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379)
};

registerProcessAlertHandlers("worker");

const worker = new Worker<TimedActionJobData>(
  "timed-actions-queue",
  async (job) => {
    const timedAction = await db.timedAction.findUnique({
      where: {
        id: job.data.timedActionId
      }
    });

    if (!timedAction) {
      throw new Error(`TimedAction ${job.data.timedActionId} not found`);
    }

    if (timedAction.status !== "PENDING") {
      return;
    }

    logger.info("Executing timed action completion", {
      actionType: timedAction.actionType,
      guildId: timedAction.guildId,
      userId: timedAction.userId,
      timedActionId: timedAction.id
    });

    try {
      // Placeholder for discord.js integration to lift timeout/unban in later phase.
      logger.info("Mock lift timed action", {
        actionType: timedAction.actionType,
        guildId: timedAction.guildId,
        userId: timedAction.userId,
        timedActionId: timedAction.id
      });

      await db.timedAction.update({
        where: {
          id: timedAction.id
        },
        data: {
          status: "COMPLETED"
        }
      });
    } catch (error) {
      await db.timedAction.update({
        where: {
          id: timedAction.id
        },
        data: {
          status: "FAILED"
        }
      });

      throw error;
    }
  },
  { connection }
);

worker.on("ready", () => {
  logger.info("Worker is ready");
});

worker.on("error", (error) => {
  logger.error("Worker error", { error });
  void sendCriticalAlert("Worker error", error instanceof Error ? error.message : String(error));
});
