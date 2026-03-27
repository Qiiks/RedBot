import {
  GuildMember,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Client,
  type Interaction
} from "discord.js";
import { createLogger } from "@redbot/shared";
import { checkRateLimit } from "../middleware/rateLimit";
import { evaluateCommandAccess } from "../rbac";
import { warnCommand } from "./warn";

const logger = createLogger({ service: "bot-gateway" });

export type CommandContext = {
  interaction: ChatInputCommandInteraction;
};

export type CommandHandler = (context: CommandContext) => Promise<void>;

const commandHandlers: Record<string, CommandHandler> = {
  warn: warnCommand
};

function getMemberRoleIds(member: GuildMember): string[] {
  return [...member.roles.cache.keys()];
}

function getCooldownSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

async function checkRbac(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "Access Denied",
      ephemeral: true
    });
    return false;
  }

  const member = interaction.member;
  if (!(member instanceof GuildMember)) {
    await interaction.reply({
      content: "Access Denied",
      ephemeral: true
    });
    return false;
  }

  const result = await evaluateCommandAccess({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    roleIds: getMemberRoleIds(member),
    command: interaction.commandName,
    checkDiscordPermission: () => member.permissions.has(PermissionFlagsBits.ModerateMembers)
  });

  if (!result.allowed) {
    await interaction.reply({
      content: "Access Denied",
      ephemeral: true
    });
    return false;
  }

  return true;
}

async function handleCommandInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "This command can only be used inside a server.",
      ephemeral: true
    });
    return;
  }

  const handler = commandHandlers[interaction.commandName];
  if (!handler) {
    await interaction.reply({
      content: "Unknown command.",
      ephemeral: true
    });
    return;
  }

  const rateLimit = await checkRateLimit({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    command: interaction.commandName
  });

  if (!rateLimit.allowed) {
    const retryAfterSeconds = getCooldownSeconds(rateLimit.retryAfterMs);
    await interaction.reply({
      content: `Cooldown: try again in ${retryAfterSeconds} seconds.`,
      ephemeral: true
    });
    return;
  }

  const rbacAllowed = await checkRbac(interaction);
  if (!rbacAllowed) {
    return;
  }

  await handler({ interaction });
}

export function registerCommandRouter(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      await handleCommandInteraction(interaction);
    } catch (error) {
      const message = "An unexpected error occurred while processing this command.";

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
        return;
      }

      await interaction.reply({ content: message, ephemeral: true });
      logger.error("Command handler failed", {
        commandName: interaction.commandName,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        error
      });
    }
  });
}
