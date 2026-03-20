FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY drizzle.config.ts ./

ENV NODE_ENV=production
ENV DATABASE_URL=/data/bot.db

VOLUME /data

CMD ["bun", "run", "src/index.ts"]
