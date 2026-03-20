import type { GuildConfig } from "../leveling/leveling.types";
import { getGuildConfigRow } from "./guild-config.repo";

const DEFAULTS = {
  xpMin: 15,
  xpMax: 25,
  cooldownSeconds: 60,
} as const;

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const row = await getGuildConfigRow(guildId);
  return {
    guildId,
    xpMin: row?.xpMin ?? DEFAULTS.xpMin,
    xpMax: row?.xpMax ?? DEFAULTS.xpMax,
    cooldownSeconds: row?.cooldownSeconds ?? DEFAULTS.cooldownSeconds,
    backgroundImage: row?.backgroundImage
      ? Buffer.from(row.backgroundImage)
      : null,
    backgroundImageType: row?.backgroundImageType ?? null,
  };
}
