import { Connectors, Shoukaku } from "shoukaku";
import type { Client } from "discord.js";

const LAVALINK_NODE = {
  name: "local",
  url: "127.0.0.1:2333",
  auth: "youshallnotpass"
} as const;

export function initializeShoukaku(client: Client): Shoukaku {
  const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [LAVALINK_NODE], {
    reconnectTries: 3,
    reconnectInterval: 5,
    restTimeout: 10
  });

  shoukaku.on("ready", (nodeName) => {
    console.log(`[music] Lavalink node ready: ${nodeName}`);
  });

  shoukaku.on("error", (nodeName, error) => {
    console.error(`[music] Lavalink node error (${nodeName}):`, error);
  });

  return shoukaku;
}
