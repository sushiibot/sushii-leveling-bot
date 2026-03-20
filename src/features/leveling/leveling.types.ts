import { levelFromXp } from "./xp";

export class UserLevel {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly username: string,
    public readonly xp: number,
    public readonly messageCount: number,
    public readonly lastXpAt: number,
  ) {}

  get level(): number {
    return levelFromXp(this.xp);
  }

  static from(row: {
    guildId: string;
    userId: string;
    username: string;
    xp: number;
    messageCount: number;
    lastXpAt: number;
  }): UserLevel {
    return new UserLevel(
      row.guildId,
      row.userId,
      row.username,
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
}

export interface LevelRole {
  guildId: string;
  level: number;
  roleId: string;
}
