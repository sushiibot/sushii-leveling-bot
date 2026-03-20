import { bulkUpsertUserLevels } from "../leveling/leveling.repo";
import { parseCsv } from "./csv";

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
    rows.map((r) => ({ userId: r.platformId, xp: r.xp, level: r.level })),
  );

  return result;
}
