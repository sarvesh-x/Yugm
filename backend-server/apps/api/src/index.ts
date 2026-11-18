import http from "http";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureAuthIndexes } from "./services/authIndexes.js";
import { initFirebase } from "./services/firebase.js";
import { closeJobWorkers, startJobWorkers } from "./services/jobs.js";
import { seedAchievements } from "./services/achievementSeeder.js";
import { ensureDefaultCosmetics } from "./services/cosmetics.js";
import { ensureProductionIndexes } from "./services/productionIndexes.js";
import { runMigrations } from "./config/migration.js";
import { resumePkTimers } from "./services/pk.js";
import { connectRedis } from "./services/redis.js";
import { closeSocketInfrastructure, initSocket } from "./services/socket.js";
import { ensureOfficialRooms } from "./services/officialRooms.js";
import { ensureMongoMediaIndexes } from "./services/storage.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

async function bootstrap() {
  // Only blocking work that requests truly need happens before listen().
  await connectDatabase();
  await connectRedis();
  await initFirebase();
  const app = createApp();
  const server = http.createServer(app);
  await initSocket(server);
  server.listen(env.PORT, () => {
    console.log(`Yugm API listening on http://localhost:${env.PORT}`);
  });

  // Index creation, migrations, seeds, official-room upserts and background
  // workers used to block listen(), so a cold Render instance accepted no
  // connections for tens of seconds. They are idempotent; finish them after the
  // server is already answering.
  void (async () => {
    const maintenanceSteps: Array<[string, () => Promise<unknown>]> = [
      ["mongo media indexes", ensureMongoMediaIndexes],
      ["auth indexes", ensureAuthIndexes],
      ["production indexes", ensureProductionIndexes],
      ["migrations", runMigrations],
      ["default cosmetics", ensureDefaultCosmetics],
      ["achievement seed", seedAchievements],
      ["official rooms", ensureOfficialRooms],
      ["job workers", startJobWorkers],
      ["pk timers", resumePkTimers]
    ];
    for (const [label, step] of maintenanceSteps) {
      try {
        await step();
      } catch (error) {
        console.error(`Startup maintenance failed (${label}):`, error);
      }
    }
    console.log("Startup maintenance complete");
  })();

  async function shutdown() {
    console.log("Shutting down gracefully...");
    server.close();
    await closeSocketInfrastructure();
    await closeJobWorkers();
    await disconnectDatabase();
    process.exit(0);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
