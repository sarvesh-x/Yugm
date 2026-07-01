import http from "http";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { initFirebase } from "./services/firebase.js";
import { connectRedis } from "./services/redis.js";
import { initSocket } from "./services/socket.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

async function bootstrap() {
  await connectDatabase();
  await connectRedis();
  initFirebase();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.PORT, () => {
    console.log(`Yugm API listening on http://localhost:${env.PORT}`);
  });

  async function shutdown() {
    console.log("Shutting down gracefully...");
    server.close();
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
