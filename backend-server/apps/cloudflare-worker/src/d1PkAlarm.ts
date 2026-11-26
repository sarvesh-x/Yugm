import { DurableObject } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import { nextD1PkDeadline, runD1PkDeadlines } from "../../api/src/migration/d1PkDeadlines.js";
import { createNativeRealtimePort, type NativeRealtimeBindingEnv } from "./nativeRealtimePort.js";

const RETRY_MS = 30_000;

export interface D1PkAlarmEnv extends NativeRealtimeBindingEnv {
  AUTH_DB: D1Database;
  YUGM_STAGE: string;
  YUGM_PRODUCTION_ORIGIN?: string;
}

function errorDetails(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function configuredProductionOrigin(env: D1PkAlarmEnv) {
  const value = env.YUGM_PRODUCTION_ORIGIN;
  if (!value || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname.includes(".") && !url.hostname.endsWith(".invalid") &&
    !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
}

function alarmEnabled(env: D1PkAlarmEnv) {
  if (env.YUGM_STAGE !== "local" && env.YUGM_STAGE !== "production") return false;
  return env.YUGM_STAGE === "local" || configuredProductionOrigin(env);
}

/** The singleton alarm keeps five-second PK ticks running across Worker restarts. */
export class D1PkAlarm extends DurableObject<D1PkAlarmEnv> {
  private scheduling: Promise<void> = Promise.resolve();

  async fetch(request: Request): Promise<Response> {
    if (!alarmEnabled(this.env)) return Response.json({ ok: false }, { status: 503 });
    const url = new URL(request.url);
    if (url.pathname === "/status") {
      return Response.json({ ok: true, alarm: await this.ctx.storage.getAlarm() });
    }
    if (request.method === "POST" && url.pathname === "/run") {
      await this.alarm();
      return Response.json({ ok: true });
    }
    const fallbackDue = Number(url.searchParams.get("due"));
    if (request.method === "POST" && url.pathname === "/fallback" && Number.isFinite(fallbackDue)) {
      await this.scheduleNoLaterThan(fallbackDue);
      return Response.json({ ok: true });
    }
    await this.scheduleAlarm();
    return Response.json({ ok: true });
  }

  async alarm(): Promise<void> {
    if (!alarmEnabled(this.env)) return;
    try {
      await runD1PkDeadlines(this.env.AUTH_DB, undefined, createNativeRealtimePort(this.env));
    } catch (error) {
      console.error(JSON.stringify({
        level: "error", event: "d1_pk_deadline_failed", retryMs: RETRY_MS, ...errorDetails(error)
      }));
      await this.ctx.storage.setAlarm(Date.now() + RETRY_MS);
      return;
    }
    await this.scheduleAlarm();
  }

  private async scheduleAlarm(): Promise<void> {
    this.scheduling = this.scheduling.catch(() => {}).then(async () => {
      try {
        const due = await nextD1PkDeadline(this.env.AUTH_DB);
        if (due === undefined) {
          await this.ctx.storage.deleteAlarm();
          return;
        }
        await this.setEarlier(Math.max(Date.now() + 1000, due));
      } catch (error) {
        console.error(JSON.stringify({
          level: "error", event: "d1_pk_deadline_schedule_failed", retryMs: RETRY_MS, ...errorDetails(error)
        }));
        await this.ctx.storage.setAlarm(Date.now() + RETRY_MS);
      }
    });
    return this.scheduling;
  }

  private async scheduleNoLaterThan(due: number): Promise<void> {
    this.scheduling = this.scheduling.catch(() => {}).then(() => this.setEarlier(due));
    return this.scheduling;
  }

  private async setEarlier(due: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > due) await this.ctx.storage.setAlarm(due);
  }
}
