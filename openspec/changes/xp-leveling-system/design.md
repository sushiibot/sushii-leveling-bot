## Context

Greenfield Discord bot built with Bun + TypeScript + discord.js. No existing codebase — this design establishes the architecture from scratch. The bot needs to handle guild-scoped XP leveling, image-based rank cards, role rewards at configurable levels, and a one-time CSV import of existing leveling data. SQLite (via Drizzle ORM + `bun:sqlite`) is the chosen persistence layer for simplicity and zero-dependency operation.

Reference rank card design: `openspec/changes/xp-leveling-system/rank-card-reference.jpg`

## Goals / Non-Goals

**Goals:**
- Guild-scoped XP system with configurable cooldown, XP range per guild
- Role rewards granted automatically when a user reaches a configurable level
- Commands to configure level role rewards per guild
- Canvas-rendered rank card returned as an image attachment to `/level`
- `/set-level-background <url>` for admins to set a custom card background per guild
- CSV import command to load existing leveling data (columns: `platformId, username, XP, currentLevel`)
- SQLite persistence with Drizzle ORM and Bun's native SQLite driver

**Non-Goals:**
- Web dashboard or REST API
- Global (cross-guild) leaderboards
- Voice XP or reaction XP
- Animated rank cards
- Mee6 API integration (CSV-based import only)

## Decisions

### Bun native SQLite + Drizzle ORM
Use `bun:sqlite` (built into Bun) with Drizzle ORM for type-safe queries and migrations.
**Why over better-sqlite3**: Bun's native driver is faster and requires no native compilation. Drizzle gives schema-as-code + migration CLI without the overhead of Prisma.

### Canvas rendering: `@napi-rs/canvas`
Use `@napi-rs/canvas` for rank card image generation.
**Why over `skia-canvas`**: Better Bun compatibility, prebuilt binaries, active maintenance. API mirrors browser Canvas 2D so the drawing code is portable.

Rank card layout (based on reference image `rank-card-reference.jpg`):
1. Load background image from DB blob (decoded and cached in-memory per guild)
2. Draw semi-transparent dark overlay for text readability
3. Draw circular avatar (fetched per request, small TTL cache)
4. Draw username text
5. Draw XP progress bar with current/needed XP label
6. Draw level badge and rank position (#N on server)

### XP formula
XP per message: random integer in `[xpMin, xpMax]` (guild-configurable, defaults 15–25).

Level thresholds — XP required to go from level `n` to `n+1`:
```
xpToNextLevel(n) = 5n² + 50n + 100
```
Total XP required to reach level `n` = `Σ xpToNextLevel(k)` for k=0..n-1

Verified against the provided reference table (matches exactly for all levels 0–54).

Cooldown: configurable per guild (default 60 s), tracked with an in-memory Map keyed by `guildId:userId`.

### Role rewards
A `level_roles` table maps `(guild_id, level) → role_id`. On each level-up, the service checks if the new level has a role mapped and assigns it via the Discord API. Configurable via `/set-level-role <level> <role>` and `/remove-level-role <level>`.

### CSV import
CSV format: `platformId, username, XP, currentLevel`
- Command: `/import-levels` (attaches the CSV file as a Discord attachment)
- Restricted to users with Manage Guild permission
- Parse with Bun's built-in `Bun.file` + line splitting (no extra CSV lib needed)
- Upsert each row into `user_levels` using `platformId` as `user_id`
- `currentLevel` from CSV stored directly; `XP` stored as total cumulative XP

### Command structure
| Command | Permission | Description |
|---|---|---|
| `/level [user]` | Everyone | Show rank card for self or mentioned user |
| `/set-level-background` | Manage Guild | Set custom background — accepts an image attachment, downloaded and stored in DB |
| `/set-level-role <level> <role>` | Manage Guild | Assign a role reward for reaching a level |
| `/remove-level-role <level>` | Manage Guild | Remove the role reward for a level |
| `/import-levels` | Manage Guild | Import leveling data from attached CSV file |

### Project structure

Feature modules: each feature owns its service (business logic), repository (data access), and command/event handlers co-located. Repositories are the DAO layer for that feature's tables — analogous to DAOs within the same package in Java.

```
src/
  index.ts                      # Entry point, client init, feature registration
  client.ts                     # Discord client factory

  features/
    leveling/
      leveling.service.ts       # XP grants, level-up logic, role reward dispatch
      leveling.repo.ts          # user_levels DB queries
      leveling.events.ts        # messageCreate → XP grant handler
      leveling.commands.ts      # /level command
      leveling.types.ts         # Shared types for this feature

    guild-config/
      guild-config.service.ts   # Config reads/writes, defaults
      guild-config.repo.ts      # guild_configs + level_roles DB queries
      guild-config.commands.ts  # /set-level-background, /set-level-role, /remove-level-role

    import/
      import.service.ts         # CSV parse + bulk upsert via leveling.repo
      import.commands.ts        # /import-levels command

    rank-card/
      rank-card.service.ts      # Canvas rendering, image buffer cache

  db/
    schema.ts                   # Drizzle schema (all tables)
    index.ts                    # DB client singleton, WAL mode setup
    migrations/                 # Drizzle-generated migration SQL

  deploy-commands.ts            # One-shot slash command registration script
```

`import` calls through `leveling.repo` for upserts — it does not own its own repo since it writes to `user_levels`.

### Database schema (Drizzle)
```
guild_configs(guild_id PK, xp_min, xp_max, cooldown_seconds, background_image BLOB, background_image_type TEXT)
user_levels(guild_id, user_id, username, xp, level, message_count, last_xp_at)  PK(guild_id, user_id)
level_roles(guild_id, level, role_id)  PK(guild_id, level)
```

Background image stored as a raw binary BLOB alongside its MIME type. Downloaded from the provided URL at set-time so the bot is not dependent on the URL remaining valid.

## Risks / Trade-offs

- **Canvas native binaries**: `@napi-rs/canvas` requires prebuilt binaries — must verify Bun compatibility; include in Docker image if containerized. → Pin version; test on target platform early.
- **Background image size**: Storing images as BLOBs in SQLite keeps the DB self-contained but large images inflate DB size. → Validate max upload size (e.g. 8 MB) at set-time and reject oversized images.
- **SQLite write contention**: SQLite is single-writer; high-traffic guilds could queue writes. → WAL mode enabled; XP grants are fast single-row upserts, acceptable at bot scale.
- **Role assignment on level-up**: Bot must have Manage Roles permission and its role must be above the reward role in hierarchy. → Document this requirement; catch and log permission errors gracefully without crashing.
- **CSV user_id mapping**: CSV `platformId` values are Discord user IDs mapped directly to `user_id`. Users who left the server have stored XP but no resolvable profile; rank card falls back to stored `username` from CSV.

## Migration Plan

1. Run `drizzle-kit generate` to produce initial migration SQL
2. On bot startup, apply pending migrations programmatically
3. Run `/import-levels` with `levelling-data-lisa-226132.csv` to seed existing data
4. No rollback needed for initial deploy (additive schema only)

## Open Questions

- What is the maximum acceptable background image file size?
