import { db } from "@redbot/db";
import type { AuditCategory, Prisma } from "@prisma/client";

type AuditMetadata = Prisma.InputJsonValue;

export type EmitAuditEventInput = {
  guildId: string;
  category: AuditCategory;
  action: string;
  actorId?: string | null;
  targetId?: string | null;
  metadata: AuditMetadata;
};

export type EmitAuditEventResult = {
  eventId: string;
  createdAt: Date;
  logChannelId: string | null;
  markdown: string | null;
};

function formatActorTargetLine(label: string, value?: string | null): string {
  return `- **${label}:** ${value ?? "N/A"}`;
}

function formatMetadataMarkdown(metadata: AuditMetadata): string {
  if (metadata === null) {
    return "null";
  }

  return JSON.stringify(metadata, null, 2);
}

function escapeCodeBlockContent(content: string): string {
  return content.replace(/```/g, "``\\`");
}

function buildAuditMarkdown(input: EmitAuditEventInput, createdAt: Date): string {
  const lines = [
    `### ${input.category} • ${input.action}`,
    `- **Guild:** ${input.guildId}`,
    formatActorTargetLine("Actor", input.actorId),
    formatActorTargetLine("Target", input.targetId),
    `- **Timestamp:** ${createdAt.toISOString()}`,
    "- **Metadata:**",
    "```json",
    formatMetadataMarkdown(input.metadata),
    "```"
  ];

  return lines.join("\n");
}

export async function emitAuditEvent(input: EmitAuditEventInput): Promise<EmitAuditEventResult> {
  const settings = await db.guildSettings.findUnique({
    where: { guildId: input.guildId },
    select: {
      logChannelId: true
    }
  });

  const created = await db.auditEvent.create({
    data: {
      guildId: input.guildId,
      category: input.category,
      action: input.action,
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata,
      createdAt: new Date()
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  const markdown = settings?.logChannelId ? buildAuditMarkdown(input, created.createdAt) : null;

  return {
    eventId: created.id,
    createdAt: created.createdAt,
    logChannelId: settings?.logChannelId ?? null,
    markdown
  };
}

export async function formatMessageSnapshot(guildId: string, content: string): Promise<string> {
  const settings = await db.guildSettings.findUnique({
    where: { guildId },
    select: {
      contentSnapshotsEnabled: true
    }
  });

  if (!settings?.contentSnapshotsEnabled) {
    return "Message content redacted by guild policy";
  }

  const normalized = content.trim().length > 0 ? content : "[empty message]";
  return `\`\`\`\n${escapeCodeBlockContent(normalized)}\n\`\`\``;
}
