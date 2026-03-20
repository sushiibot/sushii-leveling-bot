import { eq, and, sql, gt } from "drizzle-orm";
import { db } from "../../db";
import { userLevels } from "../../db/schema";
import { UserLevel } from "./leveling.types";
import { levelFromXp } from "./xp";

export async function getUserLevel(
  guildId: string,
  userId: string,
): Promise<UserLevel | undefined> {
  const row = await db.query.userLevels.findFirst({
    where: and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId)),
  });
  return row ? UserLevel.from(row) : undefined;
}

export async function upsertXp(
  guildId: string,
  userId: string,
  username: string,
  xpGain: number,
  now: number,
): Promise<UserLevel> {
  const existing = await getUserLevel(guildId, userId);

  if (existing) {
    const newXp = existing.xp + xpGain;
    const newLevel = levelFromXp(newXp);
    await db
      .update(userLevels)
      .set({
        xp: newXp,
        level: newLevel,
        username,
        messageCount: existing.messageCount + 1,
        lastXpAt: now,
      })
      .where(
        and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId)),
      );
    return UserLevel.from({
      guildId,
      userId,
      username,
      xp: newXp,
      messageCount: existing.messageCount + 1,
      lastXpAt: now,
    });
  } else {
    const newLevel = levelFromXp(xpGain);
    await db.insert(userLevels).values({
      guildId,
      userId,
      username,
      xp: xpGain,
      level: newLevel,
      messageCount: 1,
      lastXpAt: now,
    });
    return UserLevel.from({
      guildId,
      userId,
      username,
      xp: xpGain,
      messageCount: 1,
      lastXpAt: now,
    });
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

export interface BulkUpsertResult {
  total: number;
  levelMismatches: number;
}

export async function bulkUpsertUserLevels(
  guildId: string,
  rows: Array<{ userId: string; username: string; xp: number; level: number }>,
): Promise<BulkUpsertResult> {
  if (rows.length === 0) return { total: 0, levelMismatches: 0 };

  let levelMismatches = 0;

  for (const row of rows) {
    const computedLevel = levelFromXp(row.xp);
    if (computedLevel !== row.level) {
      levelMismatches++;
    }

    await db
      .insert(userLevels)
      .values({
        guildId,
        userId: row.userId,
        username: row.username,
        xp: row.xp,
        level: computedLevel,
        messageCount: 0,
        lastXpAt: 0,
      })
      .onConflictDoUpdate({
        target: [userLevels.guildId, userLevels.userId],
        set: {
          username: row.username,
          xp: row.xp,
          level: computedLevel,
        },
        where: gt(sql`excluded.xp`, userLevels.xp),
      });
  }

  return { total: rows.length, levelMismatches };
}
