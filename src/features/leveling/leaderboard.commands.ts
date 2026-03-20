import {
  type ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { getTopUsers } from "./leveling.repo";

export const leaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the top 10 users by XP");

export async function handleLeaderboard(
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

  const topUsers = await getTopUsers(interaction.guildId, 10);

  let content: string;
  if (topUsers.length === 0) {
    content = "No users have earned XP yet.";
  } else {
    const lines = topUsers.map(
      (user, i) => `${i + 1}. <@${user.userId}> - Level ${user.level}`,
    );
    content = `## Leaderboard\n\n${lines.join("\n")}`;
  }

  await interaction.editReply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: ComponentType.Container,
        components: [
          {
            type: ComponentType.TextDisplay,
            content,
          },
        ],
      },
    ],
  });
}
