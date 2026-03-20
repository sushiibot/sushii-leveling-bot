import type { Client, Message } from "discord.js";
import { grantXp } from "./leveling.service";

export function registerLevelingEvents(client: Client): void {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guildId || !message.guild) return;

    await grantXp(
      message.guildId,
      message.author.id,
      message.author.username,
      message.guild,
    );
  });
}
