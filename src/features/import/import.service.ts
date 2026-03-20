import { parseCsv } from "./csv";
import { bulkUpsertUserLevels } from "../leveling/leveling.repo";

export async function importFromCsv(
  guildId: string,
  csvUrl: string,
): Promise<number> {
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error("Failed to download the CSV file.");
  }

  const text = await response.text();
  const rows = parseCsv(text);

  await bulkUpsertUserLevels(
    guildId,
    rows.map((r) => ({
      userId: r.platformId,
      username: r.username,
      xp: r.xp,
      level: r.level,
    })),
  );

  return rows.length;
}
