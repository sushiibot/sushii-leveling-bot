import {
  type Client,
  Events,
  PermissionFlagsBits,
  REST,
  Routes,
} from "discord.js";
import { settingsCommand } from "./features/guild-config/settings.commands";
import { leaderboardCommand } from "./features/leveling/leaderboard.commands";
import { levelRoleCommand } from "./features/leveling/level-role.commands";
import { levelCommand } from "./features/leveling/leveling.commands";
import logger from "./logger";

const COMMANDS = [
  levelCommand,
  leaderboardCommand,
  settingsCommand,
  levelRoleCommand,
];

export function registerClientEvents(
  client: Client,
  token: string,
  clientId: string,
): void {
  client.on(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, id: c.user.id }, "Logged in");

    const permissions = (
      PermissionFlagsBits.ViewChannel |
      PermissionFlagsBits.SendMessages |
      PermissionFlagsBits.SendMessagesInThreads |
      PermissionFlagsBits.ReadMessageHistory |
      PermissionFlagsBits.AttachFiles |
      PermissionFlagsBits.EmbedLinks |
      PermissionFlagsBits.AddReactions |
      PermissionFlagsBits.UseExternalEmojis |
      PermissionFlagsBits.UseExternalStickers |
      PermissionFlagsBits.ManageRoles
    ).toString();
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${c.user.id}&permissions=${permissions}&scope=bot%20applications.commands`;
    logger.info({ inviteUrl }, "Invite URL");

    const commands = COMMANDS.map((cmd) => cmd.toJSON());
    const rest = new REST().setToken(token);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info(`Registered ${commands.length} slash commands`);
  });

  client.on(Events.GuildCreate, (guild) => {
    logger.info(
      { guildId: guild.id, name: guild.name, memberCount: guild.memberCount },
      "Joined guild",
    );
  });

  client.on(Events.GuildDelete, (guild) => {
    logger.info({ guildId: guild.id, name: guild.name }, "Left guild");
  });
}
