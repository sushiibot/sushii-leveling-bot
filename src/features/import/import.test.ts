// Must be set before any DB modules are imported
process.env.DATABASE_URL = ":memory:";

import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { levelFromXp } from "../leveling/xp";
import { parseCsv } from "./csv";

// Dynamic imports so the in-memory DATABASE_URL is used
const { bulkUpsertUserLevels, getRankPosition } = await import(
  "../leveling/leveling.repo"
);
const { runMigrations } = await import("../../db");

runMigrations();

const CSV_PATH = path.resolve(
  import.meta.dir,
  "../../../testdata/levelling-sample.csv",
);
const GUILD_ID = "test-guild";

const csvContent = readFileSync(CSV_PATH, "utf-8");
const rows = parseCsv(csvContent);

describe("parseCsv", () => {
  test("parses all rows from sample CSV", () => {
    expect(rows).toHaveLength(9);
  });

  test("first row has correct fields", () => {
    expect(rows[0]).toMatchObject({
      platformId: "1367515493191385133",
      username: '"user1"',
      xp: 3,
      level: 0,
    });
  });

  test("top user has correct fields", () => {
    expect(rows[8]).toMatchObject({
      platformId: "1317759377381392425",
      username: '"user9"',
      xp: 54195,
      level: 53,
    });
  });

  test("each row's level matches levelFromXp (formula aligned with MEE6)", () => {
    for (const row of rows) {
      expect(levelFromXp(row.xp)).toBe(row.level);
    }
  });

  test("XP values are numeric", () => {
    for (const row of rows) {
      expect(typeof row.xp).toBe("number");
      expect(Number.isNaN(row.xp)).toBe(false);
    }
  });

  test("level values are numeric", () => {
    for (const row of rows) {
      expect(typeof row.level).toBe("number");
      expect(Number.isNaN(row.level)).toBe(false);
    }
  });

  test("throws on missing header columns", () => {
    expect(() => parseCsv("platformId,username\n123,alice")).toThrow(
      "CSV must have columns",
    );
  });

  test("throws on non-numeric XP", () => {
    expect(() =>
      parseCsv("platformId,username,XP,currentLevel\n123,alice,notanumber,5"),
    ).toThrow("Non-numeric");
  });
});

describe("import + rank calculation", () => {
  beforeAll(async () => {
    await bulkUpsertUserLevels(
      GUILD_ID,
      rows.map((r) => ({ userId: r.platformId, xp: r.xp, level: r.level })),
    );
  });

  test("rank #1 is the user with the most XP", async () => {
    // will.lrs has 54195 XP — highest in the sample
    const rank = await getRankPosition(GUILD_ID, "1317759377381392425");
    expect(rank).toBe(1);
  });

  test("rank #9 is the user with the least XP", async () => {
    // cipaaa0057 has 3 XP — lowest in the sample
    const rank = await getRankPosition(GUILD_ID, "1367515493191385133");
    expect(rank).toBe(9);
  });

  test("rank order matches XP descending order", async () => {
    const sortedByXp = [...rows].sort((a, b) => b.xp - a.xp);

    for (const [i, row] of sortedByXp.entries()) {
      const rank = await getRankPosition(GUILD_ID, row.platformId);
      expect(rank).toBe(i + 1);
    }
  });
});
