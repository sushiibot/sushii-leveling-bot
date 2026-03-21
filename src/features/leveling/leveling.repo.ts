import { and, desc, eq, gt, sql } from "drizzle-orm";
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
  xpGain: number,
  now: Date,
): Promise<UserLevel> {
  const rows = await db
    .insert(userLevels)
    .values({
      guildId,
      userId,
      xp: xpGain,
      messageCount: 1,
      lastXpAt: now,
    })
    .onConflictDoUpdate({
      target: [userLevels.guildId, userLevels.userId],
      set: {
        xp: sql`${userLevels.xp} + ${xpGain}`,
        messageCount: sql`${userLevels.messageCount} + 1`,
        lastXpAt: now,
      },
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error("upsertXp returned no rows");

  return UserLevel.from(row);
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

export async function getTopUsers(
  guildId: string,
  limit = 10,
): Promise<UserLevel[]> {
  const rows = await db.query.userLevels.findMany({
    where: eq(userLevels.guildId, guildId),
    orderBy: desc(userLevels.xp),
    limit,
  });
  return rows.map(UserLevel.from);
}

export async function getAllGuildUsers(guildId: string): Promise<UserLevel[]> {
  const rows = await db.query.userLevels.findMany({
    where: eq(userLevels.guildId, guildId),
    orderBy: desc(userLevels.xp),
  });
  return rows.map(UserLevel.from);
}

export interface BulkUpsertResult {
  total: number;
  levelMismatches: number;
}

export async function bulkUpsertUserLevels(
  guildId: string,
  rows: Array<{ userId: string; xp: number; level: number }>,
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
        xp: row.xp,
        messageCount: 0,
        lastXpAt: new Date(0),
      })
      .onConflictDoUpdate({
        target: [userLevels.guildId, userLevels.userId],
        set: { xp: row.xp },
        where: gt(sql`excluded.xp`, userLevels.xp),
      });
  }

  return { total: rows.length, levelMismatches };
}
