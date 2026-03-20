import type { Guild } from "discord.js";
import { getLevelRole } from "../guild-config/guild-config.repo";
import { getGuildConfig } from "../guild-config/guild-config.service";
import { getUserLevel, upsertXp } from "./leveling.repo";

// cooldown tracking: "guildId:userId" → unix timestamp (ms)
const cooldowns = new Map<string, number>();

export async function grantXp(
  guildId: string,
  userId: string,
  username: string,
  guild: Guild,
): Promise<void> {
  const config = await getGuildConfig(guildId);

  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const lastGrant = cooldowns.get(key) ?? 0;
  const cooldownMs = config.cooldownSeconds * 1000;

  if (now - lastGrant < cooldownMs) {
    return;
  }

  cooldowns.set(key, now);

  const xpGain =
    Math.floor(Math.random() * (config.xpMax - config.xpMin + 1)) +
    config.xpMin;

  const existing = await getUserLevel(guildId, userId);
  const previousLevel = existing?.level ?? 0;

  const nowSec = Math.floor(now / 1000);
  const updated = await upsertXp(guildId, userId, username, xpGain, nowSec);

  if (updated.level > previousLevel) {
    await handleLevelUp(guildId, userId, updated.level, guild);
  }
}

async function handleLevelUp(
  guildId: string,
  userId: string,
  newLevel: number,
  guild: Guild,
): Promise<void> {
  const levelRole = await getLevelRole(guildId, newLevel);
  if (!levelRole) return;

  try {
    const member = await guild.members.fetch(userId);
    await member.roles.add(levelRole.roleId);
  } catch (err) {
    console.error(
      `Failed to assign role ${levelRole.roleId} to ${userId} in ${guildId}:`,
      err,
    );
  }
}
