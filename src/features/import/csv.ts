export interface CsvRow {
  platformId: string;
  username: string;
  xp: number;
  level: number;
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());

  const platformIdIdx = headers.indexOf("platformid");
  const usernameIdx = headers.indexOf("username");
  const xpIdx = headers.indexOf("xp");
  const levelIdx = headers.indexOf("currentlevel");

  if (
    platformIdIdx === -1 ||
    usernameIdx === -1 ||
    xpIdx === -1 ||
    levelIdx === -1
  ) {
    throw new Error(
      "CSV must have columns: platformId, username, XP, currentLevel",
    );
  }

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const cols = line.split(",");
    const platformId = cols[platformIdIdx]?.trim();
    const username = cols[usernameIdx]?.trim();
    const xpRaw = cols[xpIdx]?.trim();
    const levelRaw = cols[levelIdx]?.trim();

    if (!platformId || !username || xpRaw === undefined || levelRaw === undefined) {
      throw new Error(`Invalid row at line ${i + 1}: ${line}`);
    }

    const xp = parseInt(xpRaw, 10);
    const level = parseInt(levelRaw, 10);

    if (isNaN(xp) || isNaN(level)) {
      throw new Error(`Non-numeric XP or level at line ${i + 1}: ${line}`);
    }

    rows.push({ platformId, username, xp, level });
  }

  return rows;
}
