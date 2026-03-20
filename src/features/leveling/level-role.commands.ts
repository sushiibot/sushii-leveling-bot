import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  deleteLevelRole,
  upsertLevelRole,
} from "../guild-config/guild-config.repo";

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
  );

export async function handleLevelRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "Server only.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "set" || sub === "add") {
    await handleLevelRoleUpsert(interaction);
  } else if (sub === "delete") {
    await handleLevelRoleDelete(interaction);
  }
}

async function handleLevelRoleUpsert(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const level = interaction.options.getInteger("level", true);
  const role = interaction.options.getRole("role", true);

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  await upsertLevelRole(interaction.guildId!, level, role.id);

  await interaction.editReply(
    `Role ${role.toString()} will now be awarded at level ${level}.`,
  );
}

async function handleLevelRoleDelete(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const level = interaction.options.getInteger("level", true);

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  const deleted = await deleteLevelRole(interaction.guildId!, level);

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
