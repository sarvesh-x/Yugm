import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";
import process from "node:process";
import { consumePushQueue, type PushDispatch, type PushWake } from "./pushDispatchDo.js";
import type { PushJobData, PushPayload } from "../../api/src/services/pushDelivery.js";

export { PushDispatch } from "./pushDispatchDo.js";

const NODE_HTTP_PORT = 8787;
const MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
const MAINTENANCE_KEY = "maintenance-due";

function errorDetails(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}

export interface YugmWorkerEnv {
  API_SERVICE: DurableObjectNamespace<YugmApi>;
  PUSH_OUTBOX?: DurableObjectNamespace<PushDispatch>;
  [name: string]: unknown;
}

/**
 * The singleton routes requests to one live instance so its Node state can be
 * shared while it remains active. State can be lost on restart or hibernation.
 * The WebSocket bridge is experimental and does not support horizontal scaling.
 */
export class YugmApi extends DurableObject<YugmWorkerEnv> {
  private ready?: Promise<void>;
  private alarmScheduling: Promise<void> = Promise.resolve();

  async sendQueuedPush(data: PushJobData) {
    if (this.env.YUGM_STAGE !== "local" || !this.env.PUSH_OUTBOX) {
      throw new Error("Push queue delivery is restricted to the local Worker");
    }
    await this.ensureReady();
    const runtime = await import("./runtime.js");
    return runtime.sendQueuedPush(data);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Liveness must stay cheap and must not depend on the Node runtime or a
    // database connection. Readiness is served by Express at /ready.
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "yugm-api",
        runtime: "cloudflare",
        initialized: this.ready !== undefined,
        ready: "/ready"
      });
    }
    try {
      await this.ensureReady();
      if ((url.pathname === "/socket.io/" || url.pathname === "/socket.io") &&
          request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
        const [runtime, bridge] = await Promise.all([import("./runtime.js"), import("./socketBridge.js")]);
        return bridge.handleSocketUpgrade(request, await runtime.getSocketEngine());
      }
      const mutatesPk = request.method !== "GET" && url.pathname.startsWith("/api/pk/");
      // Persist a fallback wake-up before a PK write. If the Worker stops after
      // the database commit but before the response, an alarm still recovers it.
      if (mutatesPk) await this.scheduleNoLaterThan(Date.now() + 15_000);
      const response = await handleAsNodeRequest(NODE_HTTP_PORT, request);
      if (mutatesPk) {
        await this.scheduleAlarm();
      }
      return response;
    } catch (error) {
      // Return an explicit, non-sensitive failure instead of letting the
      // Durable Object throw an opaque Cloudflare 1101.
      console.error(JSON.stringify({
        level: "error",
        event: "worker_request_failed",
        path: url.pathname,
        ...errorDetails(error)
      }));
      return Response.json({
        ok: false,
        error: { code: "WORKER_UNAVAILABLE", message: "API runtime is not ready" }
      }, { status: 503 });
    }
  }

  async alarm(): Promise<void> {
    try {
      await this.ensureReady();
      const runtime = await import("./runtime.js");
      await runtime.runPkDeadlines();
      const maintenanceDue = await this.ctx.storage.get<number>(MAINTENANCE_KEY);
      if (maintenanceDue === undefined || maintenanceDue <= Date.now()) {
        await runtime.runScheduledMaintenance();
        await this.ctx.storage.put(MAINTENANCE_KEY, Date.now() + MAINTENANCE_INTERVAL_MS);
      }
      await this.scheduleAlarm();
    } catch (error) {
      // Avoid losing durable work after the platform's finite retry window.
      console.error(JSON.stringify({
        level: "error",
        event: "scheduled_room_work_failed",
        retryMs: 30_000,
        ...errorDetails(error)
      }));
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    }
  }

  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.startRuntime().catch((error) => {
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  private async startRuntime(): Promise<void> {
    // Startup performs indexes, migrations and seeding. Require an explicit
    // isolated staging database acknowledgement before it can touch any data.
    // Production is disabled until the migration acceptance checks are complete.
    if (this.env.YUGM_STAGE === "production") {
      throw new Error("Production Worker is disabled pending migration acceptance");
    }
    if (this.env.YUGM_STAGE !== "local" && this.env.YUGM_STAGE !== "staging") {
      throw new Error("YUGM_STAGE must be local or staging");
    }
    if (this.env.MONGODB_DB_NAME !== "YugmStaging") {
      throw new Error("The Worker requires the isolated YugmStaging database");
    }
    if (this.env.YUGM_STAGE === "staging" && this.env.STAGING_DB_ISOLATED !== "true") {
      throw new Error("Set STAGING_DB_ISOLATED=true only after verifying the staging cluster and credentials are isolated");
    }
    for (const [key, value] of Object.entries(this.env)) {
      if (typeof value === "string" && value.length > 0) process.env[key] = value;
    }
    process.env.NODE_ENV = "production";
    process.env.YUGM_RUNTIME = "cloudflare";
    process.env.PORT = String(NODE_HTTP_PORT);

    let pushDispatcher: ((payload: PushPayload) => Promise<void>) | undefined;
    if (this.env.YUGM_STAGE === "local" && this.env.YUGM_LOCAL_PUSH_QUEUE === "true") {
      const outbox = this.env.PUSH_OUTBOX;
      if (!outbox) throw new Error("Local push queue is missing its outbox binding");
      pushDispatcher = (payload) => outbox.getByName(payload.data.notificationId).enqueue(payload);
    }
    const runtime = await import("./runtime.js");
    await runtime.startApiRuntime(this.env, (work) => this.ctx.waitUntil(work), pushDispatcher);
    await this.scheduleAlarm();
  }

  private scheduleAlarm(): Promise<void> {
    // Serialize reads and writes so concurrent PK requests cannot move an
    // earlier alarm later. Deadlines live in MongoDB and survive restarts.
    this.alarmScheduling = this.alarmScheduling.catch(() => {}).then(async () => {
      const runtime = await import("./runtime.js");
      let maintenance = await this.ctx.storage.get<number>(MAINTENANCE_KEY);
      if (maintenance === undefined) {
        maintenance = Date.now() + MAINTENANCE_INTERVAL_MS;
        await this.ctx.storage.put(MAINTENANCE_KEY, maintenance);
      }
      const pkDeadline = await runtime.nextPkDeadline();
      const due = Math.max(Date.now() + 1000, Math.min(maintenance, pkDeadline ?? Infinity));
      const current = await this.ctx.storage.getAlarm();
      if (current === null || current > due) await this.ctx.storage.setAlarm(due);
    });
    return this.alarmScheduling;
  }

  private scheduleNoLaterThan(due: number): Promise<void> {
    this.alarmScheduling = this.alarmScheduling.catch(() => {}).then(async () => {
      const current = await this.ctx.storage.getAlarm();
      if (current === null || current > due) await this.ctx.storage.setAlarm(due);
    });
    return this.alarmScheduling;
  }
}

export default {
  async queue(batch: MessageBatch<PushWake>, env: YugmWorkerEnv): Promise<void> {
    if (env.YUGM_STAGE !== "local" || !env.PUSH_OUTBOX) {
      throw new Error("Push queue consumer is restricted to the local Worker");
    }
    await consumePushQueue(batch, env.PUSH_OUTBOX);
  },
  async fetch(request: Request, env: YugmWorkerEnv): Promise<Response> {
    try {
      const id = env.API_SERVICE.idFromName("yugm-global-api");
      return await env.API_SERVICE.get(id).fetch(request);
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "worker_binding_failed",
        path: new URL(request.url).pathname,
        ...errorDetails(error)
      }));
      return Response.json({
        ok: false,
        error: { code: "WORKER_UNAVAILABLE", message: "API binding is not available" }
      }, { status: 503 });
    }
  }
};
