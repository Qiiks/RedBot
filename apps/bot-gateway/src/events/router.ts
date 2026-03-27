import type { Client, GuildMember } from "discord.js";
import { createLogger } from "@redbot/shared";
import { registerAutomodListener } from "./automod";
import { restoreRoles } from "../roles/persistence";

const logger = createLogger({ service: "bot-gateway" });

function getAssignableRoleIds(member: GuildMember, roleIds: string[]): string[] {
  return roleIds.filter((roleId) => {
    const role = member.guild.roles.cache.get(roleId);
    return !!role?.editable;
  });
}

export function registerEventRouter(client: Client): void {
  registerAutomodListener(client);

  client.on("guildMemberAdd", async (member) => {
    try {
      const restoredRoleIds = await restoreRoles(member.guild.id, member.id);
      if (restoredRoleIds.length === 0) {
        return;
      }

      const assignableRoleIds = getAssignableRoleIds(member, restoredRoleIds);
      if (assignableRoleIds.length === 0) {
        logger.info("Role restore skipped: no assignable roles", {
          guildId: member.guild.id,
          userId: member.id
        });
        return;
      }

      await member.roles.add(assignableRoleIds, "Role persistence restore on member join");

      logger.info("Roles restored on member join", {
        guildId: member.guild.id,
        userId: member.id,
        restoredRoleCount: assignableRoleIds.length
      });
    } catch (error) {
      logger.error("Role restore failed", {
        guildId: member.guild.id,
        userId: member.id,
        error
      });
    }
  });
}
