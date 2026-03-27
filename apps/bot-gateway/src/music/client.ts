import { Connectors, Shoukaku } from "shoukaku";
import type { Client } from "discord.js";
import { createLogger } from "@redbot/shared";

const logger = createLogger({ service: "bot-gateway" });

function getLavalinkNodeConfig() {
  const secureRaw = process.env.LAVALINK_NODE_SECURE?.trim().toLowerCase();

  return {
    name: process.env.LAVALINK_NODE_NAME ?? "local",
    url: process.env.LAVALINK_NODE_URL ?? "127.0.0.1:2333",
    auth: process.env.LAVALINK_NODE_AUTH ?? "youshallnotpass",
    secure: secureRaw === "true" || secureRaw === "1"
  };
}

export function initializeShoukaku(client: Client): Shoukaku {
  const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [getLavalinkNodeConfig()], {
    reconnectTries: 3,
    reconnectInterval: 5,
    restTimeout: 10
  });

  shoukaku.on("ready", (nodeName) => {
    logger.info("Lavalink node ready", { nodeName });
  });

  shoukaku.on("error", (nodeName, error) => {
    logger.error("Lavalink node error", { nodeName, error });
  });

  return shoukaku;
}
