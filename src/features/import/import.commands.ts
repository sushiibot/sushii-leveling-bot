import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { importFromCsv } from "./import.service";

export const importLevelsCommand = new SlashCommandBuilder()
  .setName("import-levels")
  .setDescription("Import leveling data from a CSV file attachment")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addAttachmentOption((opt) =>
    opt
      .setName("file")
      .setDescription(
        "CSV file with columns: platformId, username, XP, currentLevel",
      )
      .setRequired(true),
  );

export async function handleImportLevels(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "Server only.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const attachment = interaction.options.getAttachment("file", true);

  try {
    const { total, levelMismatches } = await importFromCsv(
      interaction.guildId,
      attachment.url,
    );
    const mismatchNote =
      levelMismatches > 0
        ? ` (${levelMismatches} levels recomputed from XP — CSV values did not match)`
        : " (all levels matched recomputed values)";
    await interaction.editReply(
      `Successfully imported ${total} records.${mismatchNote}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await interaction.editReply(`Import failed: ${message}`);
  }
}
