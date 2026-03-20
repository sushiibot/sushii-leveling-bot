import {
  type ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextDisplayBuilder,
  roleMention,
} from "discord.js";
import {
  deleteLevelRole,
  getLevelRoles,
  upsertLevelRole,
} from "../guild-config/guild-config.repo";

function container(content: string) {
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content),
  );
}

export const levelRoleCommand = new SlashCommandBuilder()
  .setName("level-role")
  .setDescription("Manage level role rewards")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set the role reward for a level (replaces existing)")
      .addIntegerOption((opt) =>
        opt
          .setName("level")
          .setDescription("Level that triggers the role reward")
          .setRequired(true)
          .setMinValue(1),
      )
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Role to assign").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a role reward for a level")
      .addIntegerOption((opt) =>
        opt
          .setName("level")
          .setDescription("Level that triggers the role reward")
          .setRequired(true)
          .setMinValue(1),
      )
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Role to assign").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Remove the role reward for a level")
      .addIntegerOption((opt) =>
        opt
          .setName("level")
          .setDescription("Level whose role reward to remove")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all level role rewards"),
  );

export async function handleLevelRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [container("This command can only be used in a server.")],
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "set" || sub === "add") {
    await handleLevelRoleUpsert(interaction);
  } else if (sub === "delete") {
    await handleLevelRoleDelete(interaction);
  } else if (sub === "list") {
    await handleLevelRoleList(interaction);
  }
}

async function handleLevelRoleUpsert(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const level = interaction.options.getInteger("level", true);
  const role = interaction.options.getRole("role", true);

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  await upsertLevelRole(interaction.guildId!, level, role.id);

  await interaction.editReply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(
        `## Level Role Added\n\n${role.toString()} will now be awarded at level ${level}.`,
      ),
    ],
  });
}

async function handleLevelRoleDelete(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const level = interaction.options.getInteger("level", true);

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  const deleted = await deleteLevelRole(interaction.guildId!, level);

  const content =
    deleted === 0
      ? `No role reward was configured for level ${level}.`
      : `## Level Role Removed\n\nRole reward for level ${level} has been removed.`;

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [container(content)],
  });
}

async function handleLevelRoleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  const roles = await getLevelRoles(interaction.guildId!);

  let content: string;
  if (roles.length === 0) {
    content = "No level role rewards have been configured.";
  } else {
    const lines = roles
      .sort((a, b) => a.level - b.level)
      .map((r) => `Level ${r.level}: ${roleMention(r.roleId)}`);
    content = `## Level Role Rewards\n\n${lines.join("\n")}`;
  }

  await interaction.editReply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [container(content)],
  });
}
