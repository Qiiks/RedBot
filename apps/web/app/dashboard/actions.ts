"use server";

import { auth } from "@/auth";
import { getManageableGuildsForUser } from "@/lib/discord-guilds";
import { db } from "@redbot/db";
import { getRedisConnectionConfig } from "@redbot/shared";
import Redis from "ioredis";
import { redirect } from "next/navigation";

const ALLOWED_QUEUE_FAIRNESS = new Set(["FIFO", "ROUND_ROBIN"] as const);

function getRedisPublisher(): Redis {
  return new Redis({
    ...getRedisConnectionConfig(),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });
}

function assertDiscordAuthConfigured(): void {
  if (!process.env.AUTH_DISCORD_ID || !process.env.AUTH_DISCORD_SECRET) {
    throw new Error("Discord auth is not configured for this deployment.");
  }
}

export async function updateGuildSettings(
  guildId: string,
  formData: FormData
): Promise<void> {
  assertDiscordAuthConfigured();

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
    return;
  }

  const guilds = await getManageableGuildsForUser(userId);
  const targetGuild = guilds.find((guild) => guild.id === guildId);

  if (!targetGuild) {
    throw new Error("Forbidden: missing MANAGE_GUILD permission for this guild.");
  }

  const logChannelRaw = (formData.get("logChannelId") ?? "").toString().trim();
  const logChannelId = logChannelRaw.length ? logChannelRaw : null;

  const contentSnapshotsEnabled = formData.get("contentSnapshotsEnabled") === "on";

  const queueFairnessInput = (formData.get("musicQueueFairness") ?? "ROUND_ROBIN")
    .toString()
    .trim()
    .toUpperCase();

  if (!ALLOWED_QUEUE_FAIRNESS.has(queueFairnessInput as "FIFO" | "ROUND_ROBIN")) {
    throw new Error("Invalid music queue fairness value.");
  }

  const musicQueueFairness = queueFairnessInput as "FIFO" | "ROUND_ROBIN";

  await db.guild.upsert({
    where: { id: guildId },
    create: {
      id: guildId,
      name: targetGuild.name,
      ownerId: userId
    },
    update: {
      name: targetGuild.name
    }
  });

  await db.guildSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      logChannelId,
      contentSnapshotsEnabled,
      musicQueueFairness
    },
    update: {
      logChannelId,
      contentSnapshotsEnabled,
      musicQueueFairness
    }
  });

  const redis = getRedisPublisher();
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    await redis.publish(
      `guild-config-update:${guildId}`,
      JSON.stringify({
        guildId,
        updatedByUserId: userId,
        updatedAt: new Date().toISOString()
      })
    );
  } finally {
    redis.disconnect();
  }
}

export async function getDashboardGuilds() {
  assertDiscordAuthConfigured();

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
    return [];
  }

  return getManageableGuildsForUser(userId);
}

export async function getGuildSettingsForDashboard(guildId: string) {
  assertDiscordAuthConfigured();

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
    return {
      guild: { id: guildId, name: "Unknown", icon: null },
      settings: {
        logChannelId: "",
        contentSnapshotsEnabled: false,
        musicQueueFairness: "ROUND_ROBIN" as const
      }
    };
  }

  const guilds = await getManageableGuildsForUser(userId);
  const targetGuild = guilds.find((guild) => guild.id === guildId);

  if (!targetGuild) {
    throw new Error("Forbidden: missing MANAGE_GUILD permission for this guild.");
  }

  const settings = await db.guildSettings.findUnique({
    where: { guildId },
    select: {
      logChannelId: true,
      contentSnapshotsEnabled: true,
      musicQueueFairness: true
    }
  });

  return {
    guild: targetGuild,
    settings: {
      logChannelId: settings?.logChannelId ?? "",
      contentSnapshotsEnabled: settings?.contentSnapshotsEnabled ?? false,
      musicQueueFairness: settings?.musicQueueFairness ?? "ROUND_ROBIN"
    }
  };
}
