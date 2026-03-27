import { db } from "@redbot/db";
import { createLogger } from "@redbot/shared";
import { Client, GatewayIntentBits } from "discord.js";
import Redis from "ioredis";
import { registerCommandRouter } from "./commands/router";
import { registerEventRouter } from "./events/router";
import { registerProcessAlertHandlers } from "./logging/alerts";

const logger = createLogger({ service: "bot-gateway" });

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]
});

registerCommandRouter(client);
registerEventRouter(client);
registerProcessAlertHandlers("bot-gateway");

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true
});

async function subscribeToGuildConfigUpdates(): Promise<void> {
  if (redisSubscriber.status === "wait") {
    await redisSubscriber.connect();
  }

  await redisSubscriber.psubscribe("guild-config-update:*");

  redisSubscriber.on("pmessage", (_pattern, channel, payload) => {
    const guildId = channel.split(":")[1] ?? "unknown";
    logger.info("Received guild config update", {
      guildId,
      payload
    });
  });
}

client.once("ready", async () => {
  await db.$queryRaw`SELECT 1`;
  await subscribeToGuildConfigUpdates();
  logger.info("Bot is online and connected to DB");
});

void client.login(token);
