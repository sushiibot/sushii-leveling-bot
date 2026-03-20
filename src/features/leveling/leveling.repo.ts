import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { userLevels } from "../../db/schema";
import type { UserLevel } from "./leveling.types";

export async function getUserLevel(
  guildId: string,
  userId: string,
): Promise<UserLevel | undefined> {
  return db.query.userLevels.findFirst({
    where: and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId)),
  });
}

export async function upsertXp(
  guildId: string,
  userId: string,
  username: string,
  xpGain: number,
  newLevel: number,
  now: number,
): Promise<UserLevel> {
  const existing = await getUserLevel(guildId, userId);

  if (existing) {
    const newXp = existing.xp + xpGain;
    const updatedLevel = Math.max(existing.level, newLevel);
    await db
      .update(userLevels)
      .set({
        xp: newXp,
        level: updatedLevel,
        username,
        messageCount: existing.messageCount + 1,
        lastXpAt: now,
      })
      .where(
        and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId)),
      );
    return {
      ...existing,
      xp: newXp,
      level: updatedLevel,
      username,
      messageCount: existing.messageCount + 1,
      lastXpAt: now,
    };
  } else {
    const row: UserLevel = {
      guildId,
      userId,
      username,
      xp: xpGain,
      level: newLevel,
      messageCount: 1,
      lastXpAt: now,
    };
    await db.insert(userLevels).values(row);
    return row;
  }
}

export async function getRankPosition(
  guildId: string,
  userId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userLevels)
    .where(
      and(
        eq(userLevels.guildId, guildId),
        sql`xp > (select xp from ${userLevels} where guild_id = ${guildId} and user_id = ${userId})`,
      ),
    );
  return (result[0]?.count ?? 0) + 1;
}

export async function bulkUpsertUserLevels(
  guildId: string,
  rows: Array<{ userId: string; username: string; xp: number; level: number }>,
): Promise<void> {
  if (rows.length === 0) return;

  for (const row of rows) {
    await db
      .insert(userLevels)
      .values({
        guildId,
        userId: row.userId,
        username: row.username,
        xp: row.xp,
        level: row.level,
        messageCount: 0,
        lastXpAt: 0,
      })
      .onConflictDoUpdate({
        target: [userLevels.guildId, userLevels.userId],
        set: {
          username: row.username,
          xp: row.xp,
          level: row.level,
        },
      });
  }
}
