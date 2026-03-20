import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "./data/bot.db";

const sqlite = new Database(url, { create: true });
sqlite.exec("PRAGMA journal_mode=WAL;");

export const db = drizzle(sqlite, { schema });

export function runMigrations(): void {
  migrate(db, { migrationsFolder: "./src/db/migrations" });
}
