import { db } from "@redbot/db";
import { Queue } from "bullmq";

const timedActionsQueue = new Queue("timed-actions-queue", {
  connection: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379)
  }
});

const WARNING_DECAY_WINDOW_DAYS = 7;
const WARNING_ESCALATION_THRESHOLD = 3;
const AUTO_TIMEOUT_DURATION_MS = 10 * 60 * 1000;

export type IssueWarningInput = {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
};

export type IssueWarningResult = {
  warningId: string;
  warningCountInWindow: number;
  escalated: boolean;
  timedActionId?: string;
  expiresAt?: Date;
};

function getDecayWindowStart(now: Date): Date {
  return new Date(now.getTime() - WARNING_DECAY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export async function issueWarning(input: IssueWarningInput): Promise<IssueWarningResult> {
  const now = new Date();
  const decayWindowStart = getDecayWindowStart(now);

  const warning = await db.warning.create({
    data: {
      guildId: input.guildId,
      userId: input.userId,
      moderatorId: input.moderatorId,
      reason: input.reason,
      createdAt: now
    }
  });

  const warningCountInWindow = await db.warning.count({
    where: {
      guildId: input.guildId,
      userId: input.userId,
      createdAt: {
        gte: decayWindowStart
      }
    }
  });

  if (warningCountInWindow < WARNING_ESCALATION_THRESHOLD) {
    return {
      warningId: warning.id,
      warningCountInWindow,
      escalated: false
    };
  }

  const expiresAt = new Date(now.getTime() + AUTO_TIMEOUT_DURATION_MS);

  const timedAction = await db.timedAction.create({
    data: {
      guildId: input.guildId,
      userId: input.userId,
      actionType: "TIMEOUT",
      expiresAt,
      status: "PENDING",
      createdAt: now
    }
  });

  const delay = Math.max(0, expiresAt.getTime() - Date.now());

  await timedActionsQueue.add(
    "timed-action.execute",
    {
      timedActionId: timedAction.id,
      guildId: input.guildId,
      userId: input.userId,
      actionType: "TIMEOUT"
    },
    {
      jobId: timedAction.id,
      delay,
      removeOnComplete: 500,
      removeOnFail: 1000
    }
  );

  return {
    warningId: warning.id,
    warningCountInWindow,
    escalated: true,
    timedActionId: timedAction.id,
    expiresAt
  };
}
