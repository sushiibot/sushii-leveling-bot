import { createClient } from "./client";
import { runMigrations } from "./db";
import { registerClientEvents } from "./events";
import { registerLevelingEvents } from "./features/leveling/leveling.events";
import { registerInteractions } from "./interactions";
import logger from "./logger";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token) throw new Error("DISCORD_TOKEN is not set");
if (!clientId) throw new Error("CLIENT_ID is not set");

runMigrations();
logger.info("Migrations applied.");

const client = createClient();

registerLevelingEvents(client);
registerInteractions(client);
registerClientEvents(client, token, clientId);

await client.login(token);
