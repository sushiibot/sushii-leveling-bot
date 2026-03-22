import type { Guild } from "discord.js";
import logger from "../../logger";
import { getLevelRoles } from "../guild-config/guild-config.repo";
import { getGuildConfig } from "../guild-config/guild-config.service";
import { getUserLevel, upsertXp } from "./leveling.repo";

// cooldown tracking: "guildId:userId" → unix timestamp (ms)
const cooldowns = new Map<string, number>();

export async function grantXp(
  guildId: string,
  userId: string,
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

  const updated = await upsertXp(guildId, userId, xpGain, new Date(now));

  if (updated.level > previousLevel) {
    logger.debug(
      { guildId, userId, previousLevel, newLevel: updated.level },
      "User leveled up",
    );
    await syncLevelRoles(guildId, userId, updated.level, guild);
  }
}

export async function syncLevelRoles(
  guildId: string,
  userId: string,
  newLevel: number,
  guild: Guild,
): Promise<void> {
  const allRoles = await getLevelRoles(guildId);
  const earnedRoles = allRoles.filter((r) => r.level <= newLevel);
  const pendingRoles = allRoles.filter((r) => r.level > newLevel);

  if (earnedRoles.length === 0) return;

  try {
    const member = await guild.members.fetch(userId);

    const toAssign = earnedRoles.filter(
      (r) => !member.roles.cache.has(r.roleId),
    );
    const alreadyHad = earnedRoles.filter((r) =>
      member.roles.cache.has(r.roleId),
    );

    await Promise.all(toAssign.map((r) => member.roles.add(r.roleId)));

    if (toAssign.length > 0) {
      logger.info(
        {
          guildId,
          userId,
          currentLevel: newLevel,
          assigned: toAssign.map((r) => ({ roleId: r.roleId, level: r.level })),
        },
        "Assigned missing level roles",
      );
    }

    logger.debug(
      {
        guildId,
        userId,
        newLevel,
        assigned: toAssign.map((r) => ({ roleId: r.roleId, level: r.level })),
        alreadyHad: alreadyHad.map((r) => ({
          roleId: r.roleId,
          level: r.level,
        })),
        notYetEarned: pendingRoles.map((r) => ({
          roleId: r.roleId,
          level: r.level,
        })),
      },
      "Level roles processed",
    );
  } catch (err) {
    logger.error(err, `Failed to assign roles to ${userId} in ${guildId}`);
  }
}
