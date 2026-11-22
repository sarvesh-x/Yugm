import { createServer } from "node:http";
import { installCloudflareImageProcessor } from "./imageProcessor.js";

let initialized = false;

// Engine.IO normally constructs a Node `ws` server. Workers accept upgrades
// through WebSocketPair instead; socketBridge hands the transport to Engine.IO.
class WorkerUpgradeServer { close() {} }

export async function startApiRuntime(bindings: Record<string, unknown>, trackBackground: (work: Promise<unknown>) => void): Promise<void> {
  if (initialized) return;

  // Install media processing before API modules load. When the Images binding
  // is absent, managed uploads report 503 instead of crashing the Worker on a
  // native Sharp import.
  installCloudflareImageProcessor(bindings.IMAGES);

  const [db, appModule, authIndexes, firebase, jobs, achievementSeeder, cosmetics, productionIndexes, migration, redis, socket, officialRooms, storage, roomLifecycle, livekit, bonds] = await Promise.all([
    import("../../api/src/config/db.js"),
    import("../../api/src/app.js"),
    import("../../api/src/services/authIndexes.js"),
    import("../../api/src/services/firebase.js"),
    import("../../api/src/services/jobs.js"),
    import("../../api/src/services/achievementSeeder.js"),
    import("../../api/src/services/cosmetics.js"),
    import("../../api/src/services/productionIndexes.js"),
    import("../../api/src/config/migration.js"),
    import("../../api/src/services/redis.js"),
    import("../../api/src/services/socket.js"),
    import("../../api/src/services/officialRooms.js"),
    import("../../api/src/services/storage.js"),
    import("../../api/src/services/roomLifecycle.js"),
    import("../../api/src/services/livekit.js"),
    import("../../api/src/services/bonds.js")
  ]);

  // Read media credentials directly from Durable Object bindings.
  livekit.configureLiveKit({
    apiKey: typeof bindings.LIVEKIT_API_KEY === "string" ? bindings.LIVEKIT_API_KEY : undefined,
    apiSecret: typeof bindings.LIVEKIT_API_SECRET === "string" ? bindings.LIVEKIT_API_SECRET : undefined,
    url: typeof bindings.LIVEKIT_URL === "string" ? bindings.LIVEKIT_URL : ""
  });

  await db.connectDatabase();
  roomLifecycle.setRoomBackgroundTracker(trackBackground);
  bonds.setBondBackgroundTracker(trackBackground);
  await storage.ensureMongoMediaIndexes();
  await authIndexes.ensureAuthIndexes();
  await productionIndexes.ensureProductionIndexes();
  await migration.runMigrations();
  await cosmetics.ensureDefaultCosmetics();
  await achievementSeeder.seedAchievements();
  await redis.connectRedis();
  await officialRooms.ensureOfficialRooms();
  await firebase.initFirebase();
  await jobs.startJobWorkers({ startLocalCron: false });

  const server = createServer(appModule.createApp());
  await socket.initSocket(server, { transports: ["websocket", "polling"], wsEngine: WorkerUpgradeServer });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(8787, resolve);
  });
  initialized = true;
}

export async function getSocketEngine() {
  const socket = await import("../../api/src/services/socket.js");
  return socket.io.engine;
}

export async function runScheduledMaintenance(): Promise<void> {
  const [jobs, socket] = await Promise.all([
    import("../../api/src/services/jobs.js"),
    import("../../api/src/services/socket.js")
  ]);
  await jobs.runMaintenanceTasks();
  await socket.runSocketMaintenance();
}

export async function runPkDeadlines(): Promise<void> {
  const pk = await import("../../api/src/services/pk.js");
  await pk.runPkDeadlines();
}

export async function nextPkDeadline(): Promise<number | undefined> {
  const pk = await import("../../api/src/services/pk.js");
  return pk.nextPkDeadline();
}
