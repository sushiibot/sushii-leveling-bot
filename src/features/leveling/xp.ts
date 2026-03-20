/** XP required to go from level n to n+1 */
export function xpToNextLevel(n: number): number {
  return 5 * n * n + 50 * n + 100;
}

/** Total XP required to reach level n (sum from 0 to n-1) */
export function totalXpForLevel(n: number): number {
  let total = 0;
  for (let k = 0; k < n; k++) {
    total += xpToNextLevel(k);
  }
  return total;
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
