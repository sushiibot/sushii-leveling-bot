import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const guildConfigs = sqliteTable("guild_configs", {
  guildId: text("guild_id").primaryKey(),
  xpMin: integer("xp_min").notNull().default(15),
  xpMax: integer("xp_max").notNull().default(25),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(60),
  backgroundImage: blob("background_image", { mode: "buffer" }),
  backgroundImageType: text("background_image_type"),
});

export const userLevels = sqliteTable(
  "user_levels",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    username: text("username").notNull().default(""),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    lastXpAt: integer("last_xp_at").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId] })],
);

export const levelRoles = sqliteTable(
  "level_roles",
  {
    guildId: text("guild_id").notNull(),
    level: integer("level").notNull(),
    roleId: text("role_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.level] })],
);
