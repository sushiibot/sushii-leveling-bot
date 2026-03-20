import {
  type ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { getRankPosition, getTopUsers, getUserLevel } from "./leveling.repo";

function container(content: string) {
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content),
  );
}

export const leaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the top 10 users by XP");

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [container("This command can only be used in a server.")],
    });
    return;
  }

  const [topUsers, userLevel] = await Promise.all([
    getTopUsers(interaction.guildId, 10),
    getUserLevel(interaction.guildId, interaction.user.id),
  ]);

  const serverName = interaction.guild?.name ?? "Server";

  let content: string;
  if (topUsers.length === 0) {
    content = "No users have earned XP yet.";
  } else {
    const lines = topUsers.map(
      (user, i) => `${i + 1}. <@${user.userId}> - Level ${user.level}`,
    );

    let footer: string;
    const inTop10 = topUsers.some((u) => u.userId === interaction.user.id);
    if (inTop10) {
      footer = "You're in the top 10!";
    } else if (userLevel && userLevel.xp > 0) {
      const rank = await getRankPosition(interaction.guildId, interaction.user.id);
      footer = `Your current rank is #${rank}. Keep earning XP to enter the top 10!`;
    } else {
      footer = "Start chatting to earn XP and appear on the leaderboard!";
    }

    content = `## ${serverName} Leaderboard\n\n${lines.join("\n")}\n\n${footer}`;
  }

  await interaction.reply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [container(content)],
  });
}
