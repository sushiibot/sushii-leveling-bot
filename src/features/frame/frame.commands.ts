import {
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MediaGalleryBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import {
  FRAME_STYLES,
  frameStyleById,
  randomFrameStyle,
  renderAvatarFrame,
} from "./frame.service";

const COMMAND_NAME = "avatar-frame";
const OPTION_USER = "user";
const OPTION_STYLE = "style";
const ATTACHMENT_NAME = "avatar-frame.png";

export const avatarFrameCommand = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription(
    "Frame your (or another user's) avatar with a Sawadika Game reward frame",
  )
  .setContexts(InteractionContextType.Guild)
  .addUserOption((opt) =>
    opt
      .setName(OPTION_USER)
      .setDescription("User whose avatar to frame")
      .setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName(OPTION_STYLE)
      .setDescription("Frame style (default: random)")
      .setRequired(false)
      .addChoices(
        ...FRAME_STYLES.map((style) => ({
          name: style.name,
          value: style.id,
        })),
      ),
  );

export async function handleAvatarFrame(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<void> {
  await interaction.deferReply();

  const optionUser = interaction.options.getUser(OPTION_USER);
  const targetUser = optionUser ?? interaction.user;
  const targetMember = optionUser
    ? (interaction.options.getMember(OPTION_USER) ?? targetUser)
    : interaction.member;

  const styleId = interaction.options.getString(OPTION_STYLE);
  const style = styleId ? frameStyleById(styleId) : undefined;
  const chosenStyle = style ?? randomFrameStyle();

  const avatarUrl = (targetMember ?? targetUser).displayAvatarURL({
    extension: "png",
    size: 512,
  });

  const imageBuffer = await renderAvatarFrame(avatarUrl, chosenStyle);

  const attachment = new AttachmentBuilder(imageBuffer, {
    name: ATTACHMENT_NAME,
  });

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Here's your new **${chosenStyle.name}** avatar! Download the image and set it in your Discord settings.`,
      ),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems((item) =>
        item.setURL(`attachment://${ATTACHMENT_NAME}`),
      ),
    );

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [attachment],
  });
}
