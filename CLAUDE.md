# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sushii-leveling-bot** is a Discord XP leveling bot written in TypeScript. It grants XP on messages, renders rank card images, manages level-based role rewards, and supports per-guild configuration. MEE6 data import via CSV is also supported.

## Commands

```bash
bun run dev                 # Run bot with pino-pretty logging
bun run start               # Run bot (production)
bun run rank-card:preview   # Hot-reload rank card preview

bun test                    # Run all tests
bun test src/features/leveling/xp.test.ts  # Run a single test file

bun run typecheck           # Type-check without emit
bun run lint --write        # Lint + auto-fix with Biome
bun run check               # Lint check only (no fixes)
bun run format --write      # Format with Biome

bun run db:generate         # Generate migrations from schema changes
bun run db:migrate          # Apply pending migrations
```

Pre-commit hook runs `biome check --write` automatically via lefthook.

## Environment Variables

```
DISCORD_TOKEN   # Required: bot token from Discord Developer Portal
CLIENT_ID       # Required: application/client ID
DATABASE_URL    # Optional: SQLite path (default: ./data/bot.db)
```

## Architecture

### Layered Structure

Each feature follows: **Commands → Service → Repository → DB**

- **Commands** (`*.commands.ts`) — SlashCommandBuilder definitions and interaction handlers
- **Service** (`*.service.ts`) — Business logic (XP grants, cooldowns, level-up handling)
- **Repository** (`*.repo.ts`) — Drizzle ORM queries
- **Types** (`*.types.ts`) — Shared types and class wrappers

### Startup Flow

`src/index.ts` validates env vars → runs DB migrations → creates Discord client → registers event handlers → logs in.

Interaction routing is a switch-case in `src/interactions.ts`. Commands handled: `/level`, `/leaderboard`, `/settings`, `/level-role`.

### Database (Drizzle ORM + SQLite)

Schema defined in `src/db/schema.ts`. Three tables:
- `guild_configs` — per-guild settings (XP range, cooldown, theme, background image)
- `user_levels` — composite PK `(guildId, userId)`, stores XP and message count
- `level_roles` — composite PK `(guildId, level)`, maps level thresholds to Discord roles

All user data is guild-scoped (multi-tenant).

### XP / Level Formula

Defined in `src/features/leveling/xp.ts`:
- Levels 0–4: hardcoded XP values
- Level 5+: `40n - 20` XP required per level (bigint arithmetic)

### Key Patterns

- **In-memory cooldowns** — `Map<string, number>` in `leveling.service.ts` prevents concurrent XP grants
- **Atomic upserts** — `upsertXp()` uses SQL expressions to increment counters without races
- **Deferred replies** — rank card generation defers Discord reply during canvas rendering
- **UserLevel class** — wraps DB row with a computed `level` getter from XP

## Bun Conventions

- Use `bun:sqlite` not `better-sqlite3`
- Use `Bun.file` not `node:fs` readFile/writeFile
- Bun auto-loads `.env` — no dotenv needed
- Tests use `bun:test` (`import { test, expect } from "bun:test"`)
