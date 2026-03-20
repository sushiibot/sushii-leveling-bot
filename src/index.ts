import {
  Events,
  type Interaction,
  PermissionFlagsBits,
  REST,
  Routes,
} from "discord.js";
import { createClient } from "./client";
import { runMigrations } from "./db";
import {
  handleRemoveLevelRole,
  handleSetLevelBackground,
  handleSetLevelRole,
  removeLevelRoleCommand,
  setLevelBackgroundCommand,
  setLevelRoleCommand,
} from "./features/guild-config/guild-config.commands";
import {
  handleImportLevels,
  importLevelsCommand,
} from "./features/import/import.commands";
import {
  handleLevel,
  levelCommand,
} from "./features/leveling/leveling.commands";
import { registerLevelingEvents } from "./features/leveling/leveling.events";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token) throw new Error("DISCORD_TOKEN is not set");
if (!clientId) throw new Error("CLIENT_ID is not set");

runMigrations();
console.log("Migrations applied.");

const client = createClient();

registerLevelingEvents(client);

client.on(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

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
  console.log(`Invite URL: ${inviteUrl}`);

  const commands = [
    levelCommand,
    setLevelBackgroundCommand,
    setLevelRoleCommand,
    removeLevelRoleCommand,
    importLevelsCommand,
  ].map((cmd) => cmd.toJSON());

  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`Registered ${commands.length} slash commands.`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "level":
        await handleLevel(interaction);
        break;
      case "set-level-background":
        await handleSetLevelBackground(interaction);
        break;
      case "set-level-role":
        await handleSetLevelRole(interaction);
        break;
      case "remove-level-role":
        await handleRemoveLevelRole(interaction);
        break;
      case "import-levels":
        await handleImportLevels(interaction);
        break;
    }
  } catch (err) {
    console.error(`Error handling command ${interaction.commandName}:`, err);
    const msg = "An error occurred while executing this command.";
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(msg).catch(console.error);
    } else {
      await interaction
        .reply({ content: msg, ephemeral: true })
        .catch(console.error);
    }
  }
});

await client.login(token);
