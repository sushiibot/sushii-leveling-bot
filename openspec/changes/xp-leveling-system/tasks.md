## 1. Project Setup

- [x] 1.1 Initialize Bun project with `bun init`, configure `tsconfig.json`
- [x] 1.2 Add dependencies: `discord.js`, `drizzle-orm`, `drizzle-kit`, `@napi-rs/canvas`
- [x] 1.3 Set up environment variable loading (`.env`: `DISCORD_TOKEN`, `CLIENT_ID`, `DATABASE_URL`)
- [x] 1.4 Create base project directory structure (`src/features/`, `src/db/`)

## 2. Database

- [x] 2.1 Write Drizzle schema: `guild_configs`, `user_levels`, `level_roles` tables
- [x] 2.2 Configure Drizzle with `bun:sqlite`, enable WAL mode
- [x] 2.3 Generate and apply initial migration via `drizzle-kit`
- [x] 2.4 Write DB client singleton (`src/db/index.ts`)

## 3. Discord Client

- [x] 3.1 Create Discord client factory with required intents (`Guilds`, `GuildMessages`, `MessageContent`, `GuildMembers`)
- [x] 3.2 Write `index.ts` entry point: register event handlers and log in

## 4. Guild Config Feature

- [x] 4.1 Write `guild-config.repo.ts`: get config (with defaults), upsert background blob, get/set/delete level roles
- [x] 4.2 Write `guild-config.service.ts`: wrap repo, apply default values when row absent
- [x] 4.3 Implement `/set-level-background` command: accept image attachment, validate size, download, store BLOB
- [x] 4.4 Implement `/set-level-role <level> <role>` command: upsert level_roles row
- [x] 4.5 Implement `/remove-level-role <level>` command: delete level_roles row, handle missing gracefully
- [x] 4.6 Write `guild-config.commands.ts`: register all three commands

## 5. XP Leveling Feature

- [x] 5.1 Write `leveling.types.ts`: `UserLevel`, `GuildConfig`, `LevelRole` types
- [x] 5.2 Write `xp.ts` lib: `xpToNextLevel(n)`, `totalXpForLevel(n)`, `levelFromXp(xp)`, XP-in-level progress helpers
- [x] 5.3 Write `leveling.repo.ts`: upsert XP, get user level, get rank position, bulk upsert (for import)
- [x] 5.4 Write `leveling.service.ts`: grant XP (cooldown check, random XP, level-up detection, role reward dispatch)
- [x] 5.5 Write `leveling.events.ts`: `messageCreate` handler — skip bots, call `leveling.service.grantXp`
- [x] 5.6 Implement `/level [user]` command handler in `leveling.commands.ts`

## 6. Rank Card Feature

- [x] 6.1 Write `rank-card.service.ts`: canvas setup, background BLOB loading with in-memory cache
- [x] 6.2 Implement rank card drawing: background, dark overlay, circular avatar, username, level badge, rank position
- [x] 6.3 Implement XP progress bar drawing with current/max XP labels
- [x] 6.4 Wire `/level` command to call `rank-card.service` and return PNG attachment

## 7. Import Feature

- [x] 7.1 Write `csv.ts`: parse CSV text into `{ platformId, username, xp, level }[]`, validate required columns
- [x] 7.2 Write `import.service.ts`: download attachment, parse CSV, bulk upsert via `leveling.repo`
- [x] 7.3 Implement `/import-levels` command: require attachment, call import service, respond with record count

## 8. Command Registration

- [x] 8.1 Write `deploy-commands.ts` script to register all slash commands with Discord REST API
- [ ] 8.2 Verify all commands appear in Discord after running deploy script

## 9. Integration & Testing

- [ ] 9.1 Test XP grant and cooldown end-to-end in a dev server
- [ ] 9.2 Test level-up role assignment with a test role configured
- [ ] 9.3 Test `/level` rank card renders correctly with default and custom background
- [ ] 9.4 Test `/import-levels` with `levelling-data-lisa-226132.csv` and verify record counts
- [ ] 9.5 Test `/set-level-background` with a Discord image attachment and verify URL expiry is not an issue
