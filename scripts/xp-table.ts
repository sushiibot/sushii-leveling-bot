import { totalXpForLevel, xpToNextLevel } from "../src/features/leveling/xp";

console.log("Level | XP to complete level | Total XP to complete level");
console.log("------|---------------------|------------------------");
for (let i = 0; i <= 50; i++) {
  const xpNeeded = xpToNextLevel(i);
  const totalXp = totalXpForLevel(i + 1);
  console.log(
    `${String(i).padStart(5)} | ${String(xpNeeded).padStart(19)} | ${totalXp}`,
  );
}
