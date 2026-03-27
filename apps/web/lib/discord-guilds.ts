import { db } from "@redbot/db";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const MANAGE_GUILD_PERMISSION = 0x20n;

type DiscordGuildResponse = {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
};

export type ManageableGuild = {
  id: string;
  name: string;
  icon: string | null;
};

function hasManageGuildPermission(permissions: string): boolean {
  return (BigInt(permissions) & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
}

async function getDiscordAccessTokenForUser(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "discord"
    },
    orderBy: {
      id: "desc"
    },
    select: {
      access_token: true
    }
  });

  return account?.access_token ?? null;
}

export async function getManageableGuildsForUser(userId: string): Promise<ManageableGuild[]> {
  const accessToken = await getDiscordAccessTokenForUser(userId);

  if (!accessToken) {
    return [];
  }

  const response = await fetch(`${DISCORD_API_BASE_URL}/users/@me/guilds`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Discord guilds: HTTP ${response.status}`);
  }

  const guilds = (await response.json()) as DiscordGuildResponse[];

  return guilds
    .filter((guild) => hasManageGuildPermission(guild.permissions))
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon
    }));
}

export async function userCanManageGuild(userId: string, guildId: string): Promise<boolean> {
  const guilds = await getManageableGuildsForUser(userId);
  return guilds.some((guild) => guild.id === guildId);
}
