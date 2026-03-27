import { PermissionFlagsBits, type Client, type GuildMember, type Message } from "discord.js";
import { createLogger } from "@redbot/shared";
import { emitAuditEvent } from "../logging/audit";
import { issueWarning } from "../moderation";

const logger = createLogger({ service: "bot-gateway" });

const CAPS_MIN_ALPHA_CHARS = 12;
const CAPS_RATIO_THRESHOLD = 0.7;
const SPAM_WINDOW_MS = 8_000;
const SPAM_MESSAGE_THRESHOLD = 5;

const INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/gi;

type AutomodReason = "INVITE_LINK" | "EXCESSIVE_CAPS" | "SPAM";

const spamWindowByMember = new Map<string, number[]>();

function isMemberExempt(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function detectExcessiveCaps(content: string): boolean {
  const letters = content.match(/[a-z]/gi) ?? [];
  if (letters.length < CAPS_MIN_ALPHA_CHARS) {
    return false;
  }

  const upper = content.match(/[A-Z]/g) ?? [];
  return upper.length / letters.length >= CAPS_RATIO_THRESHOLD;
}

function detectSpam(guildId: string, userId: string): boolean {
  const now = Date.now();
  const key = `${guildId}:${userId}`;
  const existing = spamWindowByMember.get(key) ?? [];
  const pruned = existing.filter((timestamp) => now - timestamp <= SPAM_WINDOW_MS);
  pruned.push(now);
  spamWindowByMember.set(key, pruned);

  return pruned.length >= SPAM_MESSAGE_THRESHOLD;
}

function extractInviteCodes(content: string): string[] {
  const matches: string[] = [];
  INVITE_REGEX.lastIndex = 0;

  let match = INVITE_REGEX.exec(content);
  while (match) {
    if (match[1]) {
      matches.push(match[1]);
    }

    match = INVITE_REGEX.exec(content);
  }

  return matches;
}

async function containsExternalInvite(message: Message<true>): Promise<boolean> {
  const inviteCodes = extractInviteCodes(message.content);
  if (inviteCodes.length === 0) {
    return false;
  }

  try {
    const invites = await message.guild.invites.fetch();
    const ownCodes = new Set(invites.map((invite) => invite.code));

    if (message.guild.vanityURLCode) {
      ownCodes.add(message.guild.vanityURLCode);
    }

    return inviteCodes.some((code) => !ownCodes.has(code));
  } catch (error) {
    logger.warn("Failed to fetch guild invites during automod; treating invite as external", {
      guildId: message.guild.id,
      messageId: message.id,
      error
    });
    return true;
  }
}

async function detectAutomodReason(message: Message<true>): Promise<AutomodReason | null> {
  if (await containsExternalInvite(message)) {
    return "INVITE_LINK";
  }

  if (detectSpam(message.guild.id, message.author.id)) {
    return "SPAM";
  }

  if (detectExcessiveCaps(message.content)) {
    return "EXCESSIVE_CAPS";
  }

  return null;
}

function warningReasonFromAutomod(reason: AutomodReason): string {
  switch (reason) {
    case "INVITE_LINK":
      return "Automod: External invite link detected";
    case "SPAM":
      return "Automod: Spam detected";
    case "EXCESSIVE_CAPS":
      return "Automod: Excessive caps detected";
  }
}

async function handleAutomodViolation(message: Message<true>, reason: AutomodReason): Promise<void> {
  await message.delete().catch((error: unknown) => {
    logger.warn("Automod could not delete violating message", {
      guildId: message.guild.id,
      channelId: message.channelId,
      messageId: message.id,
      reason,
      error
    });
  });

  const warning = await issueWarning({
    guildId: message.guild.id,
    userId: message.author.id,
    moderatorId: message.client.user.id,
    reason: warningReasonFromAutomod(reason)
  });

  await emitAuditEvent({
    guildId: message.guild.id,
    category: "MESSAGE",
    action: "AUTOMOD_TRIGGERED",
    actorId: message.client.user.id,
    targetId: message.author.id,
    metadata: {
      reason,
      messageId: message.id,
      channelId: message.channelId,
      contentLength: message.content.length,
      attachmentCount: message.attachments.size,
      warningId: warning.warningId,
      warningCountInWindow: warning.warningCountInWindow,
      escalated: warning.escalated,
      timedActionId: warning.timedActionId ?? null,
      expiresAt: warning.expiresAt?.toISOString() ?? null
    }
  });

  logger.info("Automod action executed", {
    guildId: message.guild.id,
    channelId: message.channelId,
    messageId: message.id,
    userId: message.author.id,
    reason,
    warningId: warning.warningId,
    escalated: warning.escalated
  });
}

export function registerAutomodListener(client: Client): void {
  client.on("messageCreate", async (message) => {
    if (!message.inGuild() || !message.member) {
      return;
    }

    if (message.author.bot || isMemberExempt(message.member)) {
      return;
    }

    try {
      const reason = await detectAutomodReason(message);
      if (!reason) {
        return;
      }

      await handleAutomodViolation(message, reason);
    } catch (error) {
      logger.error("Automod handler failed", {
        guildId: message.guild.id,
        channelId: message.channelId,
        messageId: message.id,
        error
      });
    }
  });
}
