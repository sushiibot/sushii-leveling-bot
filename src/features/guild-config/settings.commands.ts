import {
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { importFromCsv } from "../import/import.service";
import { getAllGuildUsers } from "../leveling/leveling.repo";
import {
  CATPPUCCIN_ACCENT_COLORS,
  invalidateBackgroundCache,
} from "../rank-card/rank-card.service";
import {
  upsertBackgroundBlob,
  upsertThemeColor,
  upsertXpRate,
} from "./guild-config.repo";

const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024; // 8 MB

function container(content: string) {
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content),
  );
}

export const settingsCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure server settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName("background")
      .setDescription("Set a custom background image for rank cards")
      .addAttachmentOption((opt) =>
        opt
          .setName("image")
          .setDescription("Image file to use as background")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("color")
      .setDescription("Set the theme color for rank cards")
      .addStringOption((opt) =>
        opt
          .setName("color")
          .setDescription("Catppuccin accent color")
          .setRequired(true)
          .addChoices(
            ...CATPPUCCIN_ACCENT_COLORS.map((c) => ({ name: c, value: c })),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("xp-rate")
      .setDescription("Set the XP awarded per message (min and max)")
      .addIntegerOption((opt) =>
        opt
          .setName("min")
          .setDescription("Minimum XP per message (default: 15)")
          .setRequired(true)
          .setMinValue(1),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("max")
          .setDescription("Maximum XP per message (default: 25)")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("export-levels")
      .setDescription("Export leveling data as a CSV file"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("import-levels")
      .setDescription("Import leveling data from a CSV file attachment")
      .addAttachmentOption((opt) =>
        opt
          .setName("file")
          .setDescription(
            "CSV file with columns: platformId, username, XP, currentLevel",
          )
          .setRequired(true),
      ),
  );

export async function handleSettings(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "background") {
    await handleSettingsBackground(interaction);
  } else if (sub === "color") {
    await handleSettingsColor(interaction);
  } else if (sub === "xp-rate") {
    await handleSettingsXpRate(interaction);
  } else if (sub === "export-levels") {
    await handleSettingsExportLevels(interaction);
  } else if (sub === "import-levels") {
    await handleSettingsImportLevels(interaction);
  }
}

async function handleSettingsBackground(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  await interaction.deferReply();

  const attachment = interaction.options.getAttachment("image", true);

  if (!attachment.contentType?.startsWith("image/")) {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container("The attachment must be an image file.")],
    });
    return;
  }

  if (attachment.size > MAX_BACKGROUND_BYTES) {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        container(
          `Image is too large. Maximum allowed size is ${MAX_BACKGROUND_BYTES / 1024 / 1024} MB.`,
        ),
      ],
    });
    return;
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        container("Failed to download the image. Please try again."),
      ],
    });
    return;
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const mimeType = attachment.contentType ?? "image/png";

  await upsertBackgroundBlob(interaction.guildId, imageBuffer, mimeType);
  invalidateBackgroundCache(interaction.guildId);

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(
        "## Settings: Background\n\nBackground image updated successfully!",
      ),
    ],
  });
}

async function handleSettingsColor(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  const color = interaction.options.getString("color", true);

  await upsertThemeColor(interaction.guildId, color);

  await interaction.reply({
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(`## Settings: Theme Color\n\nTheme color set to **${color}**.`),
    ],
  });
}

async function handleSettingsXpRate(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  const min = interaction.options.getInteger("min", true);
  const max = interaction.options.getInteger("max", true);

  if (min > max) {
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        container(
          "## Settings: XP Rate\n\nMinimum XP cannot be greater than maximum XP.",
        ),
      ],
    });
    return;
  }

  await upsertXpRate(interaction.guildId, min, max);

  await interaction.reply({
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(
        `## Settings: XP Rate\n\nXP rate set to **${min}–${max}** per message.`,
      ),
    ],
  });
}

async function handleSettingsExportLevels(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  const users = await getAllGuildUsers(interaction.guildId);

  if (users.length === 0) {
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        container(
          "## Settings: Export Levels\n\nNo leveling data found for this server.",
        ),
      ],
    });
    return;
  }

  const lines = ["platformId,XP,currentLevel"];
  for (const user of users) {
    lines.push(`${user.userId},${user.xp},${user.level}`);
  }
  const csv = lines.join("\n");
  const buffer = Buffer.from(csv, "utf-8");

  await interaction.reply({
    files: [new AttachmentBuilder(buffer, { name: "levels.csv" })],
  });
}

async function handleSettingsImportLevels(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  await interaction.deferReply();

  const attachment = interaction.options.getAttachment("file", true);

  try {
    const { total, levelMismatches } = await importFromCsv(
      interaction.guildId,
      attachment.url,
    );
    const mismatchNote =
      levelMismatches > 0
        ? `${levelMismatches} levels recomputed from XP — CSV values did not match.`
        : "All levels matched recomputed values.";
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        container(
          `## Settings: Import Levels\n\nSuccessfully imported **${total}** records.\n\n${mismatchNote}`,
        ),
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        container(`## Settings: Import Levels\n\nImport failed: ${message}`),
      ],
    });
  }
}
