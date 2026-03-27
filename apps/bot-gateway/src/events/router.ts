import type { Client, GuildMember } from "discord.js";
import { restoreRoles } from "../roles/persistence";

function getAssignableRoleIds(member: GuildMember, roleIds: string[]): string[] {
  return roleIds.filter((roleId) => {
    const role = member.guild.roles.cache.get(roleId);
    return !!role?.editable;
  });
}

export function registerEventRouter(client: Client): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      const restoredRoleIds = await restoreRoles(member.guild.id, member.id);
      if (restoredRoleIds.length === 0) {
        return;
      }

      const assignableRoleIds = getAssignableRoleIds(member, restoredRoleIds);
      if (assignableRoleIds.length === 0) {
        console.log(
          `Role restore skipped for guild=${member.guild.id} member=${member.id}: no assignable roles available`
        );
        return;
      }

      await member.roles.add(assignableRoleIds, "Role persistence restore on member join");

      console.log(
        `Restored ${assignableRoleIds.length} roles for guild=${member.guild.id} member=${member.id}`
      );
    } catch (error) {
      console.error(
        `Failed to restore roles for guild=${member.guild.id} member=${member.id}`,
        error
      );
    }
  });
}
