import { describe, expect, test } from "bun:test";
import {
  levelFromXp,
  totalXpForLevel,
  xpForNextLevelUp,
  xpInCurrentLevel,
  xpToNextLevel,
} from "./xp";

describe("xpToNextLevel", () => {
  test("level 0 requires 10 XP", () => expect(xpToNextLevel(0)).toBe(10));
  test("level 1 requires 40 XP", () => expect(xpToNextLevel(1)).toBe(40));
  test("level 2 requires 65 XP (MEE6 data, not formula)", () =>
    expect(xpToNextLevel(2)).toBe(65));
  test("level 3 requires 100 XP (40*3-20)", () =>
    expect(xpToNextLevel(3)).toBe(100));
  test("level 4 requires 140 XP (40*4-20)", () =>
    expect(xpToNextLevel(4)).toBe(140));
  // Linear formula 40n - 20 kicks in at n >= 3
  test("level 5 requires 180 XP (40*5-20)", () =>
    expect(xpToNextLevel(5)).toBe(180));
  test("level 6 requires 220 XP (40*6-20)", () =>
    expect(xpToNextLevel(6)).toBe(220));
  test("level 10 requires 380 XP (40*10-20)", () =>
    expect(xpToNextLevel(10)).toBe(380));
  test("level 50 requires 1980 XP (40*50-20)", () =>
    expect(xpToNextLevel(50)).toBe(1980));
});

describe("totalXpForLevel", () => {
  test("level 0 = 0 XP", () => expect(totalXpForLevel(0)).toBe(0));
  test("level 1 = 10 XP", () => expect(totalXpForLevel(1)).toBe(10));
  test("level 2 = 50 XP", () => expect(totalXpForLevel(2)).toBe(50));
  test("level 3 = 115 XP", () => expect(totalXpForLevel(3)).toBe(115));
  test("level 4 = 215 XP", () => expect(totalXpForLevel(4)).toBe(215));
  test("level 5 = 355 XP", () => expect(totalXpForLevel(5)).toBe(355));
  test("level 6 = 535 XP", () => expect(totalXpForLevel(6)).toBe(535));
  // Closed-form: 20n² - 40n + 55
  test("level 10 = 1655 XP", () => expect(totalXpForLevel(10)).toBe(1655));
  test("level 53 = 54115 XP", () => expect(totalXpForLevel(53)).toBe(54115));

  test("iterative and closed-form agree for n=5..20", () => {
    const iterative = (n: number) => {
      let t = 0;
      for (let k = 0; k < n; k++) t += xpToNextLevel(k);
      return t;
    };
    for (let n = 5; n <= 20; n++) {
      expect(totalXpForLevel(n)).toBe(iterative(n));
    }
  });
});

describe("levelFromXp", () => {
  test.each([
    // Exact boundaries
    [0, 0],
    [9, 0],
    [10, 1],
    [49, 1],
    [50, 2],
    [114, 2],
    [115, 3],
    [214, 3],
    [215, 4],
    [354, 4],
    [355, 5],
    [534, 5],
    [535, 6],
    // Real MEE6 users from levelling-sample.csv
    [3, 0],
    [28, 1],
    [189, 3],
    [850, 7],
    [3940, 14],
    [11241, 24],
    [25419, 36],
    [36447, 43],
    [54195, 53],
  ] as [number, number][])("levelFromXp(%i) = %i", (xp, expectedLevel) => {
    expect(levelFromXp(xp)).toBe(expectedLevel);
  });
});

describe("xpInCurrentLevel", () => {
  test("0 XP at level 0 = 0 progress", () =>
    expect(xpInCurrentLevel(0, 0)).toBe(0));
  test("15 XP at level 1 = 5 progress (15 - T(1)=10)", () =>
    expect(xpInCurrentLevel(15, 1)).toBe(5));
  test("exact threshold has 0 progress in new level", () =>
    expect(xpInCurrentLevel(totalXpForLevel(10), 10)).toBe(0));
});

describe("xpForNextLevelUp", () => {
  test("level 0 needs 10 XP", () => expect(xpForNextLevelUp(0)).toBe(10));
  test("level 5 needs 180 XP", () => expect(xpForNextLevelUp(5)).toBe(180));
});
