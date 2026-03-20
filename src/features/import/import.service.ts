import { parseCsv } from "./csv";
import { bulkUpsertUserLevels } from "../leveling/leveling.repo";

export interface ImportResult {
  total: number;
  levelMismatches: number;
}

export async function importFromCsv(
  guildId: string,
  csvUrl: string,
): Promise<ImportResult> {
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error("Failed to download the CSV file.");
  }

  const text = await response.text();
  const rows = parseCsv(text);

  const result = await bulkUpsertUserLevels(
    guildId,
    rows.map((r) => ({
      userId: r.platformId,
      username: r.username,
      xp: r.xp,
      level: r.level,
    })),
  );

  return result;
}
