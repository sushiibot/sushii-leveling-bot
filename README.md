# sushii-leveling-bot

XP leveling bot for Discord. Tracks message activity, awards XP, and displays rank cards.

## Features

- XP gain on messages with configurable cooldown
- Rank card image generation
- Role rewards at configurable level thresholds
- Import leveling data from MEE6

## Setup

```bash
bun install
```

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Run database migrations:

```bash
bun run db:migrate
```

Start the bot:

```bash
bun run start
```

## Development

```bash
bun --hot src/index.ts
```

Run tests:

```bash
bun test
```
