FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3

# Static labels
LABEL org.opencontainers.image.source=https://github.com/sushiibot/sushii-leveling-bot
LABEL org.opencontainers.image.description="Discord XP leveling bot"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY drizzle.config.ts ./

ENV NODE_ENV=production
ENV DATABASE_URL=/data/bot.db

VOLUME /data

# Build info — args at end to minimize cache invalidation
ARG GIT_HASH
ARG BUILD_DATE

ENV GIT_HASH=${GIT_HASH}
ENV BUILD_DATE=${BUILD_DATE}

LABEL org.opencontainers.image.revision=${GIT_HASH}
LABEL org.opencontainers.image.created=${BUILD_DATE}

CMD ["bun", "run", "src/index.ts"]
