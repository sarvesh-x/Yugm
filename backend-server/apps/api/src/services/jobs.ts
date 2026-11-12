import { Queue, Worker, type Job } from "bullmq";
import { notifyUser } from "./firebase.js";
import { getRedisUrl } from "./redis.js";
import { ClanMessage } from "../models/ClanMessage.js";
import { Story } from "../models/Story.js";
import { Room } from "../models/Room.js";
import { User } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { Follow } from "../models/Follow.js";
import { Block } from "../models/Block.js";
import { Notification } from "../models/Notification.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { RoomParticipant } from "../models/RoomParticipant.js";

type PushPayload = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

const redisUrl = getRedisUrl();
let pushQueue: Queue | undefined;
let pushWorker: Worker | undefined;
let cronWorker: Worker | undefined;
let cronInterval: ReturnType<typeof setInterval> | undefined;
const workerStartupTimeoutMs = 3000;
let jobsMode: "redis" | "inline" = "inline";
let lastJobError: string | undefined;
let lastCronRun: string | undefined;

function bullConnectionOptions() {
  if (!redisUrl) return undefined;
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null
  };
}

async function runInlinePush(payload: PushPayload) {
  try {
    await notifyUser(payload.userId, payload.title, payload.body, payload.data);
  } catch (error) {
    console.warn("Inline push notification failed (non-fatal):", error instanceof Error ? error.message : String(error));
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

async function runMaintenanceTasks() {
  const results: string[] = [];

  try {
    const expiredDeletionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deletedUsers = await User.find({ deletionRequestedAt: { $lte: expiredDeletionCutoff } }).select("_id").limit(100).lean();
    for (const user of deletedUsers) {
      const userId = user._id;
      await Promise.all([
        AuthSession.deleteMany({ userId }),
        DeviceToken.deleteMany({ userId }),
        Follow.deleteMany({ $or: [{ followerId: userId }, { followingId: userId }] }),
        Block.deleteMany({ $or: [{ blockerId: userId }, { blockedUserId: userId }] }),
        Notification.deleteMany({ userId }),
        DirectMessage.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
        ChatMessage.deleteMany({ senderId: userId }),
        RoomParticipant.deleteMany({ userId })
      ]);
      await Room.deleteMany({ hostId: userId });
      await User.deleteOne({ _id: userId, deletionRequestedAt: { $lte: expiredDeletionCutoff } });
    }
    if (deletedUsers.length) results.push(`Hard-deleted ${deletedUsers.length} accounts past their grace period`);
  } catch (error) {
    results.push(`Account deletion cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const expiredStories = await Story.updateMany(
      { status: "ACTIVE", expiresAt: { $lte: new Date() } },
      { $set: { status: "EXPIRED" } }
    );
    if (expiredStories.modifiedCount > 0) results.push(`Expired ${expiredStories.modifiedCount} stories`);
  } catch (error) {
    results.push(`Story expiry failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const staleRooms = await Room.updateMany(
      { status: "LIVE", createdAt: { $lte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      { $set: { status: "ENDED", endedAt: new Date() } }
    );
    if (staleRooms.modifiedCount > 0) results.push(`Ended ${staleRooms.modifiedCount} stale rooms`);
  } catch (error) {
    results.push(`Room cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const expiredVip = await User.updateMany(
      { vipExpiresAt: { $lte: new Date() }, vipTier: { $ne: null } },
      { $set: { vipTier: null, vipStartedAt: null, vipExpiresAt: null } }
    );
    if (expiredVip.modifiedCount > 0) results.push(`Downgraded ${expiredVip.modifiedCount} expired VIP users`);
  } catch (error) {
    results.push(`VIP expiry failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const oldClanMessages = await ClanMessage.deleteMany({ createdAt: { $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
    if (oldClanMessages.deletedCount > 0) results.push(`Pruned ${oldClanMessages.deletedCount} old clan messages`);
  } catch (error) {
    results.push(`Clan message prune failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const expiredSuspensions = await User.updateMany(
      { suspendedUntil: { $lte: new Date(), $ne: null } },
      { $set: { suspendedUntil: null, moderationReason: null } }
    );
    if (expiredSuspensions.modifiedCount > 0) results.push(`Unsuspended ${expiredSuspensions.modifiedCount} users`);
  } catch (error) {
    results.push(`Suspension cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  lastCronRun = `${new Date().toISOString()} — ${results.length > 0 ? results.join("; ") : "No work needed"}`;
  if (results.length > 0) console.log(`[Cron] ${lastCronRun}`);
}

async function startCronWorker() {
  runMaintenanceTasks();
  cronInterval = setInterval(runMaintenanceTasks, 15 * 60 * 1000);
  console.log("Cron maintenance worker started (15-minute interval)");
}

export async function startJobWorkers() {
  const connection = bullConnectionOptions();
  if (!connection) {
    jobsMode = "inline";
    console.log("Background jobs disabled: REDIS_URL is empty; running jobs inline + cron locally");
    await startCronWorker();
    return;
  }
  try {
    pushQueue = new Queue("push-notifications", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86_400, count: 5000 }
      }
    });
    pushWorker = new Worker(
      "push-notifications",
      async (job: Job<PushPayload>) => runInlinePush(job.data),
      { connection }
    );
    await withTimeout(
      Promise.all([pushQueue.waitUntilReady(), pushWorker.waitUntilReady()]),
      workerStartupTimeoutMs,
      "Job queue Redis connection timed out"
    );
    pushWorker.on("failed", (job, error) => {
      lastJobError = error.message;
      console.warn(`Push job failed (${job?.id ?? "unknown"}):`, error.message);
    });
    jobsMode = "redis";
    lastJobError = undefined;
    console.log("Background job workers started");
  } catch (error) {
    lastJobError = error instanceof Error ? error.message : String(error);
    console.warn("Background jobs unavailable; running jobs inline:", lastJobError);
    await pushWorker?.close().catch(() => {});
    await pushQueue?.close().catch(() => {});
    pushQueue = undefined;
    pushWorker = undefined;
    jobsMode = "inline";
  }
  await startCronWorker();
}

export async function enqueuePushNotification(payload: PushPayload) {
  if (!pushQueue) {
    await runInlinePush(payload);
    return;
  }
  await pushQueue.add("send", payload, { jobId: `${payload.userId}:${payload.data.notificationId ?? Date.now()}` });
}

export async function closeJobWorkers() {
  if (cronInterval) clearInterval(cronInterval);
  await pushWorker?.close();
  await pushQueue?.close();
  await cronWorker?.close();
  pushWorker = undefined;
  pushQueue = undefined;
  cronWorker = undefined;
  jobsMode = "inline";
}

export function getJobHealth() {
  return {
    mode: jobsMode,
    queueReady: Boolean(pushQueue),
    workerReady: Boolean(pushWorker),
    lastError: lastJobError,
    lastCronRun
  };
}
