import {
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { getGuildConfig } from "../guild-config/guild-config.service";
import { renderRankCard } from "../rank-card/rank-card.service";
import { getRankPosition, getUserLevel } from "./leveling.repo";
import type { UserLevel } from "./leveling.types";

export const levelCommand = new SlashCommandBuilder()
  .setName("level")
  .setDescription("Show your or another user's rank card")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check").setRequired(false),
  );

export async function handleLevel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const guildId = interaction.guildId;

  let userLevel: UserLevel | undefined = await getUserLevel(
    guildId,
    targetUser.id,
  );

  if (!userLevel) {
    userLevel = {
      guildId,
      userId: targetUser.id,
      username: targetUser.username,
      xp: 0,
      level: 0,
      messageCount: 0,
      lastXpAt: 0,
    };
  }

  const [rank, config] = await Promise.all([
    userLevel.xp > 0 ? getRankPosition(guildId, targetUser.id) : null,
    getGuildConfig(guildId),
  ]);

  const avatarUrl = targetUser.displayAvatarURL({
    extension: "png",
    size: 256,
  });
  const imageBuffer = await renderRankCard(
    guildId,
    userLevel,
    rank,
    avatarUrl,
    config.backgroundImage,
    config.themeColor,
  );

  const attachment = new AttachmentBuilder(imageBuffer, {
    name: "rank-card.png",
  });

  await interaction.editReply({ files: [attachment] });
}
