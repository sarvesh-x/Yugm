import { Queue, Worker, type Job } from "bullmq";
import { notifyUser } from "./firebase.js";
import { getRedisUrl } from "./redis.js";

type PushPayload = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

const redisUrl = getRedisUrl();
let pushQueue: Queue | undefined;
let pushWorker: Worker | undefined;
const workerStartupTimeoutMs = 3000;

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

export async function startJobWorkers() {
  const connection = bullConnectionOptions();
  if (!connection) {
    console.log("Background jobs disabled: REDIS_URL is empty; running jobs inline");
    return;
  }
  try {
    pushQueue = new Queue("push-notifications", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
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
      console.warn(`Push job failed (${job?.id ?? "unknown"}):`, error.message);
    });
    console.log("Background job workers started");
  } catch (error) {
    console.warn("Background jobs unavailable; running jobs inline:", error instanceof Error ? error.message : String(error));
    await pushWorker?.close().catch(() => {});
    await pushQueue?.close().catch(() => {});
    pushQueue = undefined;
    pushWorker = undefined;
  }
}

export async function enqueuePushNotification(payload: PushPayload) {
  if (!pushQueue) {
    await runInlinePush(payload);
    return;
  }
  await pushQueue.add("send", payload, { jobId: `${payload.userId}:${payload.data.notificationId ?? Date.now()}` });
}

export async function closeJobWorkers() {
  await pushWorker?.close();
  await pushQueue?.close();
}
