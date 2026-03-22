import {
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { getGuildConfig } from "../guild-config/guild-config.service";
import { renderRankCard } from "../rank-card/rank-card.service";
import { getRankPosition, getUserLevel } from "./leveling.repo";
import { syncLevelRoles } from "./leveling.service";
import { UserLevel } from "./leveling.types";

const COMMAND_NAME = "level";
const OPTION_USER = "user";
const ATTACHMENT_NAME = "rank-card.png";

export const levelCommand = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription("Show your or another user's rank card")
  .setContexts(InteractionContextType.Guild)
  .addUserOption((opt) =>
    opt.setName(OPTION_USER).setDescription("User to check").setRequired(false),
  );

export async function handleLevel(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  await interaction.deferReply();

  const targetUser =
    interaction.options.getUser(OPTION_USER) ?? interaction.user;
  // If a user option was provided, getMember may return null if they left the
  // server — fall back to the User. Otherwise use interaction.member (invoker
  // is always present).
  const targetMember = interaction.options.getUser(OPTION_USER)
    ? (interaction.options.getMember(OPTION_USER) ?? targetUser)
    : interaction.member;
  const guildId = interaction.guildId;

  let userLevel: UserLevel | undefined = await getUserLevel(
    guildId,
    targetUser.id,
  );

  if (!userLevel) {
    userLevel = new UserLevel(guildId, targetUser.id, 0, 0, new Date(0));
  }

  const invokerSync =
    interaction.user.id !== targetUser.id
      ? getUserLevel(guildId, interaction.user.id).then((ul) =>
          syncLevelRoles(
            guildId,
            interaction.user.id,
            ul?.level ?? 0,
            interaction.guild,
          ),
        )
      : Promise.resolve();

  const [rank, config] = await Promise.all([
    userLevel.xp > 0 ? getRankPosition(guildId, targetUser.id) : null,
    getGuildConfig(guildId),
    syncLevelRoles(guildId, targetUser.id, userLevel.level, interaction.guild),
    invokerSync,
  ]);

  const avatarUrl = (targetMember ?? targetUser).displayAvatarURL({
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
    targetUser.displayName,
  );

  const attachment = new AttachmentBuilder(imageBuffer, {
    name: ATTACHMENT_NAME,
  });

  await interaction.editReply({ files: [attachment] });
}
