export interface UserLevel {
  guildId: string;
  userId: string;
  username: string;
  xp: number;
  level: number;
  messageCount: number;
  lastXpAt: number;
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
