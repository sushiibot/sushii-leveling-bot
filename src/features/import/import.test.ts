// Must be set before any DB modules are imported
process.env.DATABASE_URL = ":memory:";

import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { levelFromXp } from "../leveling/xp";
import { parseCsv } from "./csv";

// Dynamic imports so the in-memory DATABASE_URL is used
const { bulkUpsertUserLevels, getAllGuildUsers, getRankPosition } =
  await import("../leveling/leveling.repo");
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

  test("parses CSV without username column", () => {
    const result = parseCsv("platformId,XP,currentLevel\n111,100,2");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ platformId: "111", xp: 100, level: 2 });
    expect(result[0]?.username).toBeUndefined();
  });

  test("parses multiple rows without username column", () => {
    const csv = "platformId,XP,currentLevel\n111,100,2\n222,500,5";
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ platformId: "222", xp: 500, level: 5 });
  });

  test("still parses CSV with username column (backwards compat)", () => {
    const result = parseCsv(
      "platformId,username,XP,currentLevel\n123,alice,200,3",
    );
    expect(result[0]).toMatchObject({
      platformId: "123",
      username: "alice",
      xp: 200,
      level: 3,
    });
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

describe("getAllGuildUsers", () => {
  test("returns all users for the guild", async () => {
    const users = await getAllGuildUsers(GUILD_ID);
    expect(users).toHaveLength(rows.length);
  });

  test("returns users ordered by XP descending", async () => {
    const users = await getAllGuildUsers(GUILD_ID);
    for (let i = 0; i < users.length - 1; i++) {
      expect(users[i]!.xp).toBeGreaterThanOrEqual(users[i + 1]!.xp);
    }
  });

  test("returns empty array for unknown guild", async () => {
    const users = await getAllGuildUsers("nonexistent-guild");
    expect(users).toHaveLength(0);
  });

  test("UserLevel instances have correct level computed from XP", async () => {
    const users = await getAllGuildUsers(GUILD_ID);
    for (const user of users) {
      expect(user.level).toBe(levelFromXp(user.xp));
    }
  });
});

describe("export + re-import round-trip", () => {
  const EXPORT_GUILD_ID = "export-test-guild";

  beforeAll(async () => {
    await bulkUpsertUserLevels(
      EXPORT_GUILD_ID,
      rows.map((r) => ({ userId: r.platformId, xp: r.xp, level: r.level })),
    );
  });

  test("exported CSV can be re-parsed by parseCsv", async () => {
    const users = await getAllGuildUsers(EXPORT_GUILD_ID);
    const lines = ["platformId,XP,currentLevel"];
    for (const user of users) {
      lines.push(`${user.userId},${user.xp},${user.level}`);
    }
    const csv = lines.join("\n");

    const reparsed = parseCsv(csv);
    expect(reparsed).toHaveLength(users.length);
  });

  test("re-parsed rows match original XP and level values", async () => {
    const users = await getAllGuildUsers(EXPORT_GUILD_ID);
    const lines = ["platformId,XP,currentLevel"];
    for (const user of users) {
      lines.push(`${user.userId},${user.xp},${user.level}`);
    }
    const reparsed = parseCsv(lines.join("\n"));

    for (const [i, user] of users.entries()) {
      expect(reparsed[i]).toMatchObject({
        platformId: user.userId,
        xp: user.xp,
        level: user.level,
      });
    }
  });
});
