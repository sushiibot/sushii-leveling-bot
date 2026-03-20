// Must be set before any DB modules are imported
process.env.DATABASE_URL = ":memory:";

import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { Guild } from "discord.js";

// Dynamic imports so the in-memory DATABASE_URL is used
const { grantXp } = await import("./leveling.service");
const { getUserLevel, upsertXp } = await import("./leveling.repo");
const { upsertLevelRole } = await import(
  "../guild-config/guild-config.repo"
);
const { runMigrations } = await import("../../db");

runMigrations();

// totalXpForLevel(1) = 10, totalXpForLevel(2) = 50
// Default XP grant range: 15–25, so any first message pushes a fresh user to level 1.

function makeGuild(roleAdd = mock(() => Promise.resolve(undefined))) {
  return {
    members: {
      fetch: mock((_userId: string) =>
        Promise.resolve({ roles: { add: roleAdd } }),
      ),
    },
  } as unknown as Guild;
}

describe("grantXp", () => {
  // Each test uses a unique guild ID to keep the module-level cooldown Map isolated.

  test("xp is granted to a fresh user", async () => {
    const guildId = "guild-xp";
    const userId = "user-xp";
    const guild = makeGuild();

    await grantXp(guildId, userId, guild);

    const record = await getUserLevel(guildId, userId);
    expect(record).toBeDefined();
    // Default XP range is 15–25
    expect(record!.xp).toBeGreaterThanOrEqual(15);
    expect(record!.xp).toBeLessThanOrEqual(25);
    expect(record!.messageCount).toBe(1);
  });

  test("correct level is set when leveling up", async () => {
    // A fresh user at 0 XP will receive 15–25 XP (all > threshold of 10 for level 1),
    // so they must end up at level 1 after the first grant.
    const guildId = "guild-levelup";
    const userId = "user-levelup";
    const guild = makeGuild();

    await grantXp(guildId, userId, guild);

    const record = await getUserLevel(guildId, userId);
    expect(record!.level).toBe(1);
  });

  test("level role is assigned when user levels up", async () => {
    const guildId = "guild-role";
    const userId = "user-role";
    const roleId = "role-abc123";

    // Insert the level-1 role for this guild before the grant.
    await upsertLevelRole(guildId, 1, roleId);

    const roleAdd = mock(() => Promise.resolve(undefined));
    const guild = makeGuild(roleAdd);

    await grantXp(guildId, userId, guild);

    // guild.members.fetch should have been called once for this user.
    expect((guild.members.fetch as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
    // roles.add should have received the configured role ID.
    expect(roleAdd).toHaveBeenCalledWith(roleId);
  });

  test("cooldown prevents a second xp grant within the window", async () => {
    const guildId = "guild-cooldown";
    const userId = "user-cooldown";
    const guild = makeGuild();

    // First grant succeeds.
    await grantXp(guildId, userId, guild);
    const afterFirst = await getUserLevel(guildId, userId);
    const xpAfterFirst = afterFirst!.xp;

    // Immediate second call — still within the 60-second cooldown window.
    await grantXp(guildId, userId, guild);
    const afterSecond = await getUserLevel(guildId, userId);

    expect(afterSecond!.xp).toBe(xpAfterFirst);
    expect(afterSecond!.messageCount).toBe(1);
  });

  test("cooldown expires and xp is granted again", async () => {
    const guildId = "guild-cooldown-expire";
    const userId = "user-cooldown-expire";
    const guild = makeGuild();

    const dateNow = spyOn(Date, "now");

    try {
      // The cooldown Map initialises missing keys to 0 (epoch).
      // Start at 1 000 000 ms so the check (now - 0 < 60 000) is false and the
      // first grant is allowed.
      const BASE = 1_000_000;
      dateNow.mockReturnValue(BASE);
      await grantXp(guildId, userId, guild);
      const afterFirst = await getUserLevel(guildId, userId);
      const xpAfterFirst = afterFirst!.xp;

      // Second call at BASE + 61s — past the 60-second default cooldown.
      dateNow.mockReturnValue(BASE + 61_000);
      await grantXp(guildId, userId, guild);
      const afterSecond = await getUserLevel(guildId, userId);

      expect(afterSecond!.xp).toBeGreaterThan(xpAfterFirst);
      expect(afterSecond!.messageCount).toBe(2);
    } finally {
      dateNow.mockRestore();
    }
  });

  test("all earned roles up to new level are assigned on level-up", async () => {
    // totalXpForLevel(1) = 10, totalXpForLevel(2) = 50.
    // Pre-seed at 49 XP (level 1) so the next grant (15–25 XP) pushes to level 2.
    // Roles exist for both level 1 and 2; both must be added so a rejoining member
    // catches up on any roles they lost while absent.
    const guildId = "guild-catchup";
    const userId = "user-catchup";
    const roleLevel1 = "role-catchup-1";
    const roleLevel2 = "role-catchup-2";

    await upsertXp(guildId, userId, 49, new Date(0));
    await upsertLevelRole(guildId, 1, roleLevel1);
    await upsertLevelRole(guildId, 2, roleLevel2);

    const roleAdd = mock(() => Promise.resolve(undefined));
    const guild = makeGuild(roleAdd);

    await grantXp(guildId, userId, guild);

    expect(roleAdd).toHaveBeenCalledWith(roleLevel1);
    expect(roleAdd).toHaveBeenCalledWith(roleLevel2);
    expect(roleAdd).toHaveBeenCalledTimes(2);
  });

  test("guild.members.fetch is not called when no level role is configured", async () => {
    // No level roles for this guild, so earnedRoles is empty and handleLevelUp returns early.
    const guildId = "guild-no-role";
    const userId = "user-no-role";
    const guild = makeGuild();

    await grantXp(guildId, userId, guild);

    // handleLevelUp returns early — fetch must never be called.
    expect(
      (guild.members.fetch as ReturnType<typeof mock>).mock.calls,
    ).toHaveLength(0);
  });

  test("error in guild.members.fetch is swallowed and grantXp resolves", async () => {
    const guildId = "guild-fetch-error";
    const userId = "user-fetch-error";
    const roleId = "role-fetch-error";

    await upsertLevelRole(guildId, 1, roleId);

    const guild = {
      members: {
        fetch: mock(() => Promise.reject(new Error("Missing Access"))),
      },
    } as unknown as Guild;

    // Should not throw even though fetch rejects.
    await expect(grantXp(guildId, userId, guild)).resolves.toBeUndefined();
  });

  test("role is not re-added on subsequent grants at the same level", async () => {
    // After leveling up, the role should only be assigned once.
    // Subsequent messages that keep the user at the same level must not call roles.add again.
    const guildId = "guild-no-readd";
    const userId = "user-no-readd";
    const roleId = "role-no-readd";
    await upsertLevelRole(guildId, 1, roleId);

    const roleAdd = mock(() => Promise.resolve(undefined));
    const guild = makeGuild(roleAdd);

    const dateNow = spyOn(Date, "now");
    try {
      // First grant: fresh user → levels up to 1 → role assigned.
      const BASE = 2_000_000;
      dateNow.mockReturnValue(BASE);
      await grantXp(guildId, userId, guild);
      expect(roleAdd).toHaveBeenCalledTimes(1);

      // Second grant after cooldown: user stays at level 1 → role must NOT be added again.
      dateNow.mockReturnValue(BASE + 61_000);
      await grantXp(guildId, userId, guild);
      expect(roleAdd).toHaveBeenCalledTimes(1);
    } finally {
      dateNow.mockRestore();
    }
  });

  test("no level-up event when xp gain stays within the current level", async () => {
    const guildId = "guild-no-levelup";
    const userId = "user-no-levelup";
    const roleId = "role-no-levelup";

    // totalXpForLevel(10) = 1655, totalXpForLevel(11) = 1875
    // Seed the user deep inside level 10 so a 15–25 XP grant can't reach level 11.
    await upsertXp(guildId, userId, 1800, new Date(0));
    await upsertLevelRole(guildId, 11, roleId);

    const dateNow = spyOn(Date, "now");
    try {
      // Return a timestamp far in the future so the cooldown key is fresh.
      dateNow.mockReturnValue(Date.now() + 999_999_999);

      const guild = makeGuild();
      await grantXp(guildId, userId, guild);

      // User gained XP but did not cross into level 11 — fetch must not be called.
      expect(
        (guild.members.fetch as ReturnType<typeof mock>).mock.calls,
      ).toHaveLength(0);
    } finally {
      dateNow.mockRestore();
    }
  });
});
