/**
 * XP required to go from level n to n+1.
 *
 * Derived empirically from MEE6 export data for this server.
 * For n >= 5 the formula is linear: 40n - 20.
 * For n < 3 the values are hardcoded from the observed data. n=2 (65 XP)
 * deviates from the formula (60 XP) — confirmed against real MEE6 export data.
 *
 * Closed-form total XP for n >= 3: totalXpForLevel(n) = 20n² - 40n + 55
 */
export function xpToNextLevel(n: number): number {
  if (n === 0) return 10;
  if (n === 1) return 40;
  if (n === 2) return 65;
  return 40 * n - 20;
}

/** Total XP required to reach level n (sum from 0 to n-1) */
export function totalXpForLevel(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 10;
  if (n === 2) return 50;
  // Closed-form for n >= 3: derived from summing the linear series
  return 20 * n * n - 40 * n + 55;
}

/** Derive the current level from total XP */
export function levelFromXp(xp: number): number {
  let level = 0;
  while (xp >= totalXpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/** XP the user has accumulated within their current level */
export function xpInCurrentLevel(xp: number, level: number): number {
  return xp - totalXpForLevel(level);
}

/** XP needed to advance from the current level to the next */
export function xpForNextLevelUp(level: number): number {
  return xpToNextLevel(level);
}
