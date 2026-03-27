import { db } from "@redbot/db";

function uniqueSortedRoleIds(roleIds: string[]): string[] {
  return [...new Set(roleIds)].sort();
}

function filterAssignableRoles(guildId: string, roleIds: string[]): string[] {
  // Exclude @everyone role, which is always the guild ID.
  return roleIds.filter((roleId) => roleId !== guildId);
}

export async function snapshotRoles(
  guildId: string,
  userId: string,
  currentRoleIds: string[]
): Promise<{ guildId: string; userId: string; roleIds: string[] }> {
  const normalizedRoleIds = uniqueSortedRoleIds(filterAssignableRoles(guildId, currentRoleIds));

  const snapshot = await db.rolePersistenceSnapshot.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    },
    create: {
      guildId,
      userId,
      roleIds: normalizedRoleIds
    },
    update: {
      roleIds: normalizedRoleIds
    },
    select: {
      guildId: true,
      userId: true,
      roleIds: true
    }
  });

  return snapshot;
}

export async function restoreRoles(guildId: string, userId: string): Promise<string[]> {
  const snapshot = await db.rolePersistenceSnapshot.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    },
    select: {
      roleIds: true
    }
  });

  if (!snapshot) {
    return [];
  }

  // Idempotent output: deterministic normalized role list.
  return uniqueSortedRoleIds(filterAssignableRoles(guildId, snapshot.roleIds));
}
