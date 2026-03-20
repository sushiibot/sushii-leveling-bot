## Why

The bot needs a configurable XP leveling system to reward server engagement, with a visually appealing rank card and the ability to migrate existing Mee6 leveling data so servers can switch without losing user progress.

## What Changes

- Add an XP leveling system that awards XP for messages, with configurable multipliers, cooldowns, and role rewards per guild
- Add a `/level` slash command that renders and displays a rank card image showing the user's level, XP progress, rank, and avatar
- Add a `/set-level-background` command allowing server admins to configure a custom background image for rank cards
- Add a Mee6-compatible XP import command so guilds can migrate their existing leaderboards
- Store per-user XP and level data per guild in SQLite

## Capabilities

### New Capabilities

- `xp-leveling`: Core XP system — earning XP on messages, level-up logic, configurable cooldown and multipliers per guild, role rewards on level-up
- `rank-card`: Render a rank card image (canvas-based) showing avatar, username, level, XP bar, rank position, and configurable background
- `mee6-import`: Import user XP/level data from Mee6's public leaderboard API into the local SQLite database
- `level-background-config`: Guild admin command to set and persist a custom background image URL for rank cards

### Modified Capabilities

## Impact

- New dependencies: `@napi-rs/canvas` (or `skia-canvas`) for image rendering, Drizzle ORM + `better-sqlite3` for SQLite storage
- New slash commands: `/level`, `/set-level-background`, `/import-mee6`
- Requires message event listener for XP grants
- Guild-scoped configuration table for leveling settings and background image URL
- User XP table scoped per guild
