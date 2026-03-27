import { emitAuditEvent } from "../logging/audit";
import { issueWarning } from "../moderation";
import type { CommandHandler } from "./router";

export const warnCommand: CommandHandler = async ({ interaction }) => {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "This command can only be used inside a server.",
      ephemeral: true
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);

  const warning = await issueWarning({
    guildId: interaction.guildId,
    userId: targetUser.id,
    moderatorId: interaction.user.id,
    reason
  });

  await emitAuditEvent({
    guildId: interaction.guildId,
    category: "MODERATION",
    action: "WARN_ISSUED",
    actorId: interaction.user.id,
    targetId: targetUser.id,
    metadata: {
      reason,
      warningId: warning.warningId,
      warningCountInWindow: warning.warningCountInWindow,
      escalated: warning.escalated,
      timedActionId: warning.timedActionId ?? null,
      expiresAt: warning.expiresAt?.toISOString() ?? null
    }
  });

  const escalationMessage = warning.escalated
    ? ` Escalated to 10-minute timeout (action: ${warning.timedActionId ?? "unknown"}).`
    : "";

  await interaction.reply({
    content: `Warning issued to <@${targetUser.id}>. Count in 7-day window: ${warning.warningCountInWindow}.${escalationMessage}`,
    ephemeral: false
  });
};
