import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { importFromCsv } from "./import.service";

export const importLevelsCommand = new SlashCommandBuilder()
  .setName("import-levels")
  .setDescription("Import leveling data from a CSV file attachment")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addAttachmentOption((opt) =>
    opt
      .setName("file")
      .setDescription("CSV file with columns: platformId, username, XP, currentLevel")
      .setRequired(true),
  );

export async function handleImportLevels(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Server only.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const attachment = interaction.options.getAttachment("file", true);

  try {
    const count = await importFromCsv(interaction.guildId, attachment.url);
    await interaction.editReply(`Successfully imported ${count} records.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await interaction.editReply(`Import failed: ${message}`);
  }
}
