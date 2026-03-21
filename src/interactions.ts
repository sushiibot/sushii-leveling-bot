import {
  type Client,
  Events,
  type Interaction,
  MessageFlags,
} from "discord.js";
import { handleSettings } from "./features/guild-config/settings.commands";
import { handleLeaderboard } from "./features/leveling/leaderboard.commands";
import {
  handleLevelRole,
  handleLevelRoleAutocomplete,
  handleLevelRoleImportSubmit,
  LEVEL_ROLE_IMPORT_MODAL_ID,
} from "./features/leveling/level-role.commands";
import { handleLevel } from "./features/leveling/leveling.commands";
import logger from "./logger";

export function registerInteractions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === LEVEL_ROLE_IMPORT_MODAL_ID) {
        await handleLevelRoleImportSubmit(interaction).catch((e) =>
          logger.error(e, "Error handling level-role import modal"),
        );
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "level-role") {
        await handleLevelRoleAutocomplete(interaction).catch((e) =>
          logger.error(e, "Error handling autocomplete"),
        );
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    logger.info(
      {
        command: interaction.commandName,
        subcommand: interaction.options.getSubcommand(false),
        userId: interaction.user.id,
        username: interaction.user.username,
        guildId: interaction.guildId,
      },
      "Command received",
    );

    try {
      switch (interaction.commandName) {
        case "level":
          await handleLevel(interaction);
          break;
        case "leaderboard":
          await handleLeaderboard(interaction);
          break;
        case "settings":
          await handleSettings(interaction);
          break;
        case "level-role":
          await handleLevelRole(interaction);
          break;
      }
    } catch (err) {
      logger.error(
        { err, command: interaction.commandName },
        "Error handling command",
      );
      const msg = "An error occurred while executing this command.";
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg).catch((e) => logger.error(e));
      } else {
        await interaction
          .reply({ content: msg, flags: MessageFlags.Ephemeral })
          .catch((e) => logger.error(e));
      }
    }
  });
}
