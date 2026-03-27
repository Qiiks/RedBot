import { db } from "@redbot/db";
import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
  await db.$queryRaw`SELECT 1`;
  console.log("Bot is online and connected to DB");
});

void client.login(token);
