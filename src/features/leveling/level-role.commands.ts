import {
  ActionRowBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
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
  .setDescription("Manage level roles")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set the level role for a level (replaces existing)")
      .addIntegerOption((opt) =>
        opt
          .setName("level")
          .setDescription("Level that grants the role")
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
      .setDescription("Remove the level role for a level")
      .addIntegerOption((opt) =>
        opt
          .setName("level")
          .setDescription("Level whose role to remove")
          .setRequired(true)
          .setMinValue(1)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all level roles"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("import")
      .setDescription(
        "Bulk import level roles from a text list (opens a form)",
      ),
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

  if (sub === "set") {
    await handleLevelRoleUpsert(interaction);
  } else if (sub === "delete") {
    await handleLevelRoleDelete(interaction);
  } else if (sub === "list") {
    await handleLevelRoleList(interaction);
  } else if (sub === "import") {
    await handleLevelRoleImportModal(interaction);
  }
}

async function handleLevelRoleUpsert(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const level = interaction.options.getInteger("level", true);
  const role = interaction.options.getRole("role", true);

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  await upsertLevelRole(interaction.guildId!, level, role.id);

  await interaction.reply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(
        `## Level Role Set\n\n${role.toString()} will be assigned at level ${level}.`,
      ),
    ],
  });
}

async function handleLevelRoleDelete(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const level = interaction.options.getInteger("level", true);

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  const deleted = await deleteLevelRole(interaction.guildId!, level);

  const content = deleted
    ? `## Level Role Removed\n\n${roleMention(deleted.roleId)} (level ${level}) has been removed.`
    : `No level role was configured for level ${level}.`;

  await interaction.reply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [container(content)],
  });
}

export async function handleLevelRoleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused(true);
  if (focused.name !== "level") {
    await interaction.respond([]);
    return;
  }

  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  const roles = await getLevelRoles(interaction.guildId!);

  const query = focused.value.toString().toLowerCase();

  const choices = roles
    .sort((a, b) => a.level - b.level)
    .map((r) => {
      const roleName =
        interaction.guild?.roles.cache.get(r.roleId)?.name ?? r.roleId;
      return {
        name: `Level: ${r.level} - Role: ${roleName}`,
        value: r.level,
      };
    })
    .filter((c) => c.name.toLowerCase().includes(query))
    .slice(0, 25);

  await interaction.respond(choices);
}

export const LEVEL_ROLE_IMPORT_MODAL_ID = "level-role-import";

async function handleLevelRoleImportModal(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(LEVEL_ROLE_IMPORT_MODAL_ID)
    .setTitle("Import Level Roles")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("roles")
          .setLabel("Level roles (one per line)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("1: @Bronze LILY\n4: @Silver LILY\n7: <@&123456789>")
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

export async function handleLevelRoleImportSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This command can only be used in a server.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });

  const raw = interaction.fields.getTextInputValue("roles");

  // Each line: `LEVEL: @Role Name` or `LEVEL: <@&ROLE_ID>` or `LEVEL @Role Name`
  const ROLE_MENTION_RE = /^(\d+)\s*[:\s]\s*<@&(\d+)>/;
  const ROLE_NAME_RE = /^(\d+)\s*[:\s]\s*@(.+)/;

  const results: string[] = [];
  let imported = 0;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const mentionMatch = line.match(ROLE_MENTION_RE);
    if (mentionMatch) {
      const level = parseInt(mentionMatch[1]!, 10);
      const roleId = mentionMatch[2]!;
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) {
        results.push(`- Line \`${line}\`: role ID \`${roleId}\` not found`);
        continue;
      }
      await upsertLevelRole(interaction.guildId, level, roleId);
      results.push(`- Level ${level}: ${role.toString()} ✓`);
      imported++;
      continue;
    }

    const nameMatch = line.match(ROLE_NAME_RE);
    if (nameMatch) {
      const level = parseInt(nameMatch[1]!, 10);
      const roleName = nameMatch[2]!.trim();
      const role = interaction.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === roleName.toLowerCase(),
      );
      if (!role) {
        results.push(`- Line \`${line}\`: role \`@${roleName}\` not found`);
        continue;
      }
      await upsertLevelRole(interaction.guildId, level, role.id);
      results.push(`- Level ${level}: ${role.toString()} ✓`);
      imported++;
      continue;
    }

    results.push(
      `- Line \`${line}\`: could not parse (use \`LEVEL: @RoleName\`)`,
    );
  }

  const summary =
    imported > 0
      ? `## Level Roles Imported\n\n${imported} role(s) imported:\n${results.join("\n")}`
      : `## Import Failed\n\nNo roles were imported:\n${results.join("\n")}`;

  await interaction.editReply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [container(summary)],
  });
}

async function handleLevelRoleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  // biome-ignore lint/style/noNonNullAssertion: guildId checked above
  const roles = await getLevelRoles(interaction.guildId!);

  let content: string;
  if (roles.length === 0) {
    content = "No level roles have been configured.";
  } else {
    const lines = roles
      .sort((a, b) => a.level - b.level)
      .map((r) => `Level ${r.level}: ${roleMention(r.roleId)}`);
    content = `## Level Roles\n\n${lines.join("\n")}`;
  }

  await interaction.reply({
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
    components: [container(content)],
  });
}
