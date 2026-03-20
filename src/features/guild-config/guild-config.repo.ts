import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { guildConfigs, levelRoles } from "../../db/schema";
import type { LevelRole } from "../leveling/leveling.types";

export async function getGuildConfigRow(
  guildId: string,
): Promise<typeof guildConfigs.$inferSelect | undefined> {
  return db.query.guildConfigs.findFirst({
    where: eq(guildConfigs.guildId, guildId),
  });
}

export async function upsertBackgroundBlob(
  guildId: string,
  blob: Buffer,
  mimeType: string,
): Promise<void> {
  await db
    .insert(guildConfigs)
    .values({ guildId, backgroundImage: blob, backgroundImageType: mimeType })
    .onConflictDoUpdate({
      target: guildConfigs.guildId,
      set: { backgroundImage: blob, backgroundImageType: mimeType },
    });
}

export async function getLevelRoles(guildId: string): Promise<LevelRole[]> {
  const rows = await db.query.levelRoles.findMany({
    where: eq(levelRoles.guildId, guildId),
  });
  return rows;
}

export async function upsertLevelRole(
  guildId: string,
  level: number,
  roleId: string,
): Promise<void> {
  await db
    .insert(levelRoles)
    .values({ guildId, level, roleId })
    .onConflictDoUpdate({
      target: [levelRoles.guildId, levelRoles.level],
      set: { roleId },
    });
}

export async function deleteLevelRole(
  guildId: string,
  level: number,
): Promise<number> {
  const existing = await getLevelRole(guildId, level);
  if (!existing) return 0;
  await db
    .delete(levelRoles)
    .where(and(eq(levelRoles.guildId, guildId), eq(levelRoles.level, level)));
  return 1;
}

export async function getLevelRole(
  guildId: string,
  level: number,
): Promise<LevelRole | undefined> {
  return db.query.levelRoles.findFirst({
    where: and(eq(levelRoles.guildId, guildId), eq(levelRoles.level, level)),
  });
}
