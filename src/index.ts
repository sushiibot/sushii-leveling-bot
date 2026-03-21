import { createClient } from "./client";
import { runMigrations } from "./db";
import { registerClientEvents } from "./events";
import { registerLevelingEvents } from "./features/leveling/leveling.events";
import { HealthcheckService } from "./healthcheck";
import { registerInteractions } from "./interactions";
import logger from "./logger";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token) throw new Error("DISCORD_TOKEN is not set");
if (!clientId) throw new Error("CLIENT_ID is not set");

runMigrations();
logger.info("Migrations applied.");

const client = createClient();

const healthcheckPort = process.env.HEALTHCHECK_PORT
  ? Number(process.env.HEALTHCHECK_PORT)
  : 3000;

const healthcheck = new HealthcheckService(client, healthcheckPort);
healthcheck.start();

registerLevelingEvents(client);
registerInteractions(client);
registerClientEvents(client, token, clientId);

process.on("SIGINT", () => {
  healthcheck.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  healthcheck.stop();
  process.exit(0);
});

await client.login(token);
