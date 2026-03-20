import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { invalidateBackgroundCache } from "../rank-card/rank-card.service";
import {
  deleteLevelRole,
  upsertBackgroundBlob,
  upsertLevelRole,
} from "./guild-config.repo";

const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024; // 8 MB

export const setLevelBackgroundCommand = new SlashCommandBuilder()
  .setName("set-level-background")
  .setDescription("Set a custom background image for rank cards")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addAttachmentOption((opt) =>
    opt
      .setName("image")
      .setDescription("Image file to use as background")
      .setRequired(true),
  );

export const setLevelRoleCommand = new SlashCommandBuilder()
  .setName("set-level-role")
  .setDescription("Assign a role reward for reaching a level")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption((opt) =>
    opt
      .setName("level")
      .setDescription("Level that triggers the role reward")
      .setRequired(true)
      .setMinValue(1),
  )
  .addRoleOption((opt) =>
    opt.setName("role").setDescription("Role to assign").setRequired(true),
  );

export const removeLevelRoleCommand = new SlashCommandBuilder()
  .setName("remove-level-role")
  .setDescription("Remove the role reward for a level")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption((opt) =>
    opt
      .setName("level")
      .setDescription("Level whose role reward to remove")
      .setRequired(true)
      .setMinValue(1),
  );

export async function handleSetLevelBackground(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const attachment = interaction.options.getAttachment("image", true);

  if (!attachment.contentType?.startsWith("image/")) {
    await interaction.editReply("The attachment must be an image file.");
    return;
  }

  if (attachment.size > MAX_BACKGROUND_BYTES) {
    await interaction.editReply(
      `Image is too large. Maximum allowed size is ${MAX_BACKGROUND_BYTES / 1024 / 1024} MB.`,
    );
    return;
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    await interaction.editReply(
      "Failed to download the image. Please try again.",
    );
    return;
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const mimeType = attachment.contentType ?? "image/png";

  await upsertBackgroundBlob(interaction.guildId, imageBuffer, mimeType);
  invalidateBackgroundCache(interaction.guildId);

  await interaction.editReply("Background image updated successfully!");
}

export async function handleSetLevelRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const level = interaction.options.getInteger("level", true);
  const role = interaction.options.getRole("role", true);

  await upsertLevelRole(interaction.guildId, level, role.id);

  await interaction.editReply(
    `Role ${role.toString()} will now be awarded at level ${level}.`,
  );
}

export async function handleRemoveLevelRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const level = interaction.options.getInteger("level", true);
  const deleted = await deleteLevelRole(interaction.guildId, level);

  if (deleted === 0) {
    await interaction.editReply(
      `No role reward was configured for level ${level}.`,
    );
  } else {
    await interaction.editReply(
      `Role reward for level ${level} has been removed.`,
    );
  }
}
