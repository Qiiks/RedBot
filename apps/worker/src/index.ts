import { db } from "@redbot/db";
import { Worker } from "bullmq";

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

    console.log(
      `[TimedAction] Executing ${timedAction.actionType} completion for guild=${timedAction.guildId} user=${timedAction.userId} id=${timedAction.id}`
    );

    try {
      // Placeholder for discord.js integration to lift timeout/unban in later phase.
      console.log(
        `[TimedAction] Mock lift ${timedAction.actionType} for guild=${timedAction.guildId} user=${timedAction.userId}`
      );

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
  console.log("Worker is ready");
});

worker.on("error", (error) => {
  console.error("Worker error", error);
});
