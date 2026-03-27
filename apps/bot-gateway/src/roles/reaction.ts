import { db } from "@redbot/db";

type ReactionRoleResolutionResult = {
  roleIdToAdd: string;
  roleIdsToRemove: string[];
  groupId: string | null;
};

function normalizeRoleIds(roleIds: string[]): string[] {
  return [...new Set(roleIds)].sort();
}

export async function resolveReactionRoleAssignment(input: {
  guildId: string;
  messageId: string;
  emoji: string;
}): Promise<ReactionRoleResolutionResult | null> {
  const mapping = await db.reactionRoleMapping.findUnique({
    where: {
      messageId_emoji: {
        messageId: input.messageId,
        emoji: input.emoji
      }
    },
    include: {
      message: {
        select: {
          guildId: true,
          groupId: true
        }
      }
    }
  });

  if (!mapping) {
    return null;
  }

  if (mapping.message.guildId !== input.guildId) {
    return null;
  }

  if (!mapping.message.groupId) {
    return {
      roleIdToAdd: mapping.roleId,
      roleIdsToRemove: [],
      groupId: null
    };
  }

  const sameGroupMappings = await db.reactionRoleMapping.findMany({
    where: {
      message: {
        guildId: input.guildId,
        groupId: mapping.message.groupId
      }
    },
    select: {
      roleId: true
    }
  });

  const roleIdsToRemove = normalizeRoleIds(
    sameGroupMappings
      .map((groupMapping) => groupMapping.roleId)
      .filter((roleId) => roleId !== mapping.roleId)
  );

  return {
    roleIdToAdd: mapping.roleId,
    roleIdsToRemove,
    groupId: mapping.message.groupId
  };
}
