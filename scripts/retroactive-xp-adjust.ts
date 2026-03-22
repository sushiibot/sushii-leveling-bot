/**
 * Retroactively adjusts XP for users who accumulated XP at the old default
 * rate (15-25 XP/msg, 60s cooldown) before the rate was changed.
 *
 * Formula: adjusted_xp = csv_xp + message_count * 1
 *
 * message_count tracks only XP-granting messages on the new bot (reset to 0
 * at import), so this exactly reconstructs what users should have earned at
 * 1 XP/msg.
 *
 * Usage:
 *   bun scripts/retroactive-xp-adjust.ts --guild-id <id> --csv <path>
 *   bun scripts/retroactive-xp-adjust.ts --guild-id <id> --csv <path> --apply
 */

import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { userLevels } from "../src/db/schema";
import { parseCsv } from "../src/features/import/csv";
import { levelFromXp } from "../src/features/leveling/xp";

const args = process.argv.slice(2);
const guildId = args[args.indexOf("--guild-id") + 1];
const csvPath = args[args.indexOf("--csv") + 1];
const apply = args.includes("--apply");

if (!guildId || !csvPath) {
  console.error("Usage: bun scripts/retroactive-xp-adjust.ts --guild-id <id> --csv <path> [--apply]");
  process.exit(1);
}

const csvText = await Bun.file(csvPath).text();
const csvRows = parseCsv(csvText);
const csvByUserId = new Map(csvRows.map((r) => [r.platformId, r]));

const dbRows = await db.query.userLevels.findMany({
  where: eq(userLevels.guildId, guildId),
});

type Adjustment = {
  userId: string;
  username: string | undefined;
  csvXp: number;
  messageCount: number;
  currentXp: number;
  adjustedXp: number;
  currentLevel: number;
  adjustedLevel: number;
};

const adjustments: Adjustment[] = [];

let skippedNewUsers = 0;

for (const row of dbRows) {
  const csv = csvByUserId.get(row.userId);
  if (!csv) {
    skippedNewUsers++;
    continue;
  }

  const adjustedXp = csv.xp + row.messageCount;
  if (adjustedXp >= row.xp) continue; // no adjustment needed

  adjustments.push({
    userId: row.userId,
    username: csv.username,
    csvXp: csv.xp,
    messageCount: row.messageCount,
    currentXp: row.xp,
    adjustedXp,
    currentLevel: levelFromXp(row.xp),
    adjustedLevel: levelFromXp(adjustedXp),
  });
}

if (adjustments.length === 0) {
  console.log("No users need adjustment.");
  console.log(`(${skippedNewUsers} users skipped — not in CSV)`);
  process.exit(0);
}

adjustments.sort((a, b) => b.currentXp - a.currentXp);

console.log(`${apply ? "Applying" : "Dry run —"} ${adjustments.length} adjustment(s), ${skippedNewUsers} new users skipped\n`);
console.log(
  "Username".padEnd(20),
  "CSV XP".padStart(8),
  "+ msgs".padStart(7),
  "= Adj XP".padStart(9),
  "Current XP".padStart(11),
  "XP saved".padStart(9),
  "Lvl".padStart(5),
  "→ Adj Lvl".padStart(10),
);
console.log("-".repeat(85));

for (const a of adjustments) {
  console.log(
    (a.username ?? a.userId).slice(0, 19).padEnd(20),
    String(a.csvXp).padStart(8),
    String(`+${a.messageCount}`).padStart(7),
    String(a.adjustedXp).padStart(9),
    String(a.currentXp).padStart(11),
    String(`-${a.currentXp - a.adjustedXp}`).padStart(9),
    String(a.currentLevel).padStart(5),
    `→ ${a.adjustedLevel}`.padStart(10),
  );
}

if (!apply) {
  console.log("\nRun with --apply to commit changes.");
  process.exit(0);
}

console.log("\nApplying...");
for (const a of adjustments) {
  await db
    .update(userLevels)
    .set({ xp: a.adjustedXp })
    .where(
      and(
        eq(userLevels.guildId, guildId),
        eq(userLevels.userId, a.userId),
      ),
    );
}
console.log("Done.");
