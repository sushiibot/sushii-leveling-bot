CREATE TABLE `guild_configs` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`xp_min` integer DEFAULT 15 NOT NULL,
	`xp_max` integer DEFAULT 25 NOT NULL,
	`cooldown_seconds` integer DEFAULT 60 NOT NULL,
	`background_image` blob,
	`background_image_type` text
);
--> statement-breakpoint
CREATE TABLE `level_roles` (
	`guild_id` text NOT NULL,
	`level` integer NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`guild_id`, `level`)
);
--> statement-breakpoint
CREATE TABLE `user_levels` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`last_xp_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`)
);
