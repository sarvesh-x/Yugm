import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { connectRedis, redis } from "../services/redis.js";
import { ensureOfficialRooms } from "../services/officialRooms.js";

try {
  await connectDatabase();
  await connectRedis();
  await ensureOfficialRooms();
} finally {
  await redis?.quit().catch(() => {});
  await disconnectDatabase();
}
