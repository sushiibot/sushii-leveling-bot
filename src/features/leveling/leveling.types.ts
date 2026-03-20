import type { userLevels } from "../../db/schema";
import { levelFromXp } from "./xp";

export type UserLevelRow = typeof userLevels.$inferSelect;

export class UserLevel {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly xp: number,
    public readonly messageCount: number,
    public readonly lastXpAt: Date,
  ) {}

  get level(): number {
    return levelFromXp(this.xp);
  }

  static from(row: UserLevelRow): UserLevel {
    return new UserLevel(
      row.guildId,
      row.userId,
      row.xp,
      row.messageCount,
      row.lastXpAt,
    );
  }
}

export interface GuildConfig {
  guildId: string;
  xpMin: number;
  xpMax: number;
  cooldownSeconds: number;
  backgroundImage: Buffer | null;
  backgroundImageType: string | null;
  themeColor: string;
}

export interface LevelRole {
  guildId: string;
  level: number;
  roleId: string;
}
