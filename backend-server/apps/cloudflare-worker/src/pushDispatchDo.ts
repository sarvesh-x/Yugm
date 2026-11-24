import { DurableObject } from "cloudflare:workers";
import { SerializedOperations } from "@yugm/shared";
import { deliverPushJob, type PushJobData, type PushPayload } from "../../api/src/services/pushDelivery.js";
import type { YugmApi } from "./index.js";

const JOB = "job";
const MAX_ATTEMPTS = 3;
const RETRY_MS = 60_000;
const RECOVERY_MS = 15 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;
const NOTIFICATION_ID = /^[a-f0-9]{24}$/;

export type PushWake = { notificationId: string };

type PendingJob = {
  status: "pending";
  wake: PushWake;
  data: PushJobData;
  attempts: number;
  permanentFailures: number;
  dueAt: number;
  expiresAt: number;
};

type Job = PendingJob
  | { status: "completed" | "completed-with-failures"; purgeAt: number }
  | { status: "failed"; wake: PushWake; data: PushJobData; permanentFailures: number; reason: "attempts" | "expired"; purgeAt: number };

interface PushDispatchEnv {
  API_SERVICE: DurableObjectNamespace<YugmApi>;
  PUSH_QUEUE: Pick<Queue<PushWake>, "send">;
}

export async function consumePushQueue(batch: MessageBatch<PushWake>, outbox: DurableObjectNamespace<PushDispatch>) {
  for (const message of batch.messages) {
    const id = message.body?.notificationId;
    if (typeof id !== "string" || !NOTIFICATION_ID.test(id)) {
      console.warn("Discarded invalid push queue message");
      message.ack();
      continue;
    }
    try {
      await outbox.getByName(id).deliver();
      message.ack();
    } catch {
      message.retry({ delaySeconds: RETRY_MS / 1000 });
    }
  }
}

/** Each notification has an independent, durable delivery record. */
export class PushDispatch extends DurableObject<PushDispatchEnv> {
  private readonly operations = new SerializedOperations();

  async enqueue(data: PushPayload): Promise<void> {
    const notificationId = data.data.notificationId;
    if (!NOTIFICATION_ID.test(notificationId ?? "")) throw new Error("Missing push notification identity");
    await this.operations.run(async () => {
      if (await this.ctx.storage.get<Job>(JOB)) return;
      await this.accept({ notificationId }, data);
    });
  }

  async deliver(): Promise<void> {
    await this.operations.run(async () => {
      const job = await this.ctx.storage.get<Job>(JOB);
      if (job?.status !== "pending" || job.dueAt > this.now()) return;
      if (await this.finishIfExhausted(job)) return;

      job.attempts++;
      // A crash during a provider call must still leave a recovery alarm.
      job.dueAt = Math.min(this.now() + RECOVERY_MS, job.expiresAt);
      await this.save(job, job.dueAt);
      try {
        await deliverPushJob({
          data: job.data,
          updateData: async (data) => {
            job.data = data;
            await this.save(job, job.dueAt);
          }
        }, async (data) => {
          const result = await this.env.API_SERVICE.getByName("yugm-global-api").sendQueuedPush(data);
          job.permanentFailures += result.permanentFailures;
          return result;
        });
      } catch {
        if (await this.finishIfExhausted(job)) return;
        job.dueAt = Math.min(this.now() + RETRY_MS * 2 ** (job.attempts - 1), job.expiresAt);
        await this.save(job, job.dueAt);
        return;
      }
      const purgeAt = this.now() + RETENTION_MS;
      const status = job.permanentFailures ? "completed-with-failures" : "completed";
      await this.save({ status, purgeAt }, purgeAt);
    });
  }

  async status(): Promise<Job["status"] | "missing"> {
    return (await this.ctx.storage.get<Job>(JOB))?.status ?? "missing";
  }

  async replayFailed(): Promise<boolean> {
    return this.operations.run(async () => {
      const job = await this.ctx.storage.get<Job>(JOB);
      if (job?.status !== "failed") return false;
      await this.accept(job.wake, job.data, job.permanentFailures);
      return true;
    });
  }

  async alarm(): Promise<void> {
    await this.operations.run(async () => {
      const job = await this.ctx.storage.get<Job>(JOB);
      if (!job) return;
      if (job.status !== "pending") {
        if (this.now() < job.purgeAt) await this.ctx.storage.setAlarm(job.purgeAt);
        else await this.ctx.storage.delete(JOB);
        return;
      }
      if (await this.finishIfExhausted(job)) return;
      if (job.dueAt > this.now()) {
        await this.ctx.storage.setAlarm(job.dueAt);
        return;
      }
      await this.publish(job);
    });
  }

  protected now(): number {
    return Date.now();
  }

  private async accept(wake: PushWake, data: PushJobData, permanentFailures = 0) {
    const now = this.now();
    const job: PendingJob = {
      status: "pending", wake, data, attempts: 0, permanentFailures, dueAt: now, expiresAt: now + RETENTION_MS
    };
    await this.save(job, now + RECOVERY_MS);
    await this.env.PUSH_QUEUE.send(wake);
  }

  private async publish(job: PendingJob) {
    // Set the next wake-up before calling the broker so failure or expiry of
    // a broker message cannot strand the only pending delivery record.
    await this.ctx.storage.setAlarm(Math.min(this.now() + RECOVERY_MS, job.expiresAt));
    await this.env.PUSH_QUEUE.send(job.wake);
  }

  private async finishIfExhausted(job: PendingJob): Promise<boolean> {
    const now = this.now();
    if (now < job.expiresAt && job.attempts < MAX_ATTEMPTS) return false;
    const reason = now >= job.expiresAt ? "expired" : "attempts";
    const purgeAt = now + RETENTION_MS;
    await this.save({
      status: "failed", wake: job.wake, data: job.data, permanentFailures: job.permanentFailures, reason, purgeAt
    }, purgeAt);
    console.warn("Push job reached its terminal state", { notificationId: job.wake.notificationId, reason });
    return true;
  }

  private async save(job: Job, alarmAt: number): Promise<void> {
    await this.ctx.storage.transaction(async (txn) => {
      await txn.put(JOB, job);
      await txn.setAlarm(alarmAt);
    });
  }
}
