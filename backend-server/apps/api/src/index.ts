import http from "http";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureAuthIndexes } from "./services/authIndexes.js";
import { initFirebase } from "./services/firebase.js";
import { closeJobWorkers, startJobWorkers } from "./services/jobs.js";
import { seedAchievements } from "./services/achievementSeeder.js";
import { ensureOfficialRooms } from "./services/officialRooms.js";
import { ensureProductionIndexes } from "./services/productionIndexes.js";
import { resumePkTimers } from "./services/pk.js";
import { connectRedis } from "./services/redis.js";
import { closeSocketInfrastructure, initSocket } from "./services/socket.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

async function bootstrap() {
  await connectDatabase();
  await ensureAuthIndexes();
  await ensureProductionIndexes();
  await seedAchievements();
  await connectRedis();
  await ensureOfficialRooms();
  initFirebase();
  await startJobWorkers();
  const app = createApp();
  const server = http.createServer(app);
  await initSocket(server);
  await resumePkTimers();
  server.listen(env.PORT, () => {
    console.log(`Yugm API listening on http://localhost:${env.PORT}`);
  });

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
