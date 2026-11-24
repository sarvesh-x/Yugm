import type { D1Database } from "@cloudflare/workers-types";
import { preferenceForNotification, stringifyNotificationData } from "../services/notificationPreferences.js";

const minute = 60_000;
const claimSize = 8;
const maxAttempts = 3;

type PushAttempt = "SENT" | "FAILED" | "SKIPPED" | "UNREGISTERED" | "RETRY";
type PushMessage = { token: string; title: string; body: string; data: Record<string, string> };
export type PushSender = (message: PushMessage) => Promise<PushAttempt>;

type PushJob = { notification_id: string; device_id: string; attempts: number };
type PushTarget = PushJob & {
  token: string | null; title: string; body: string; type: string; data: string | null;
  is_blocked: number; deletion_requested_at: string | null; bond_notifications: number;
  roomInvites: number; hostGoingLive: number; messages: number; gifts: number;
  follows: number; safety: number; wallet: number; marketing: number;
};

export function createFcmSender(projectId: string, getAccessToken: () => Promise<string>): PushSender {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  let accessToken: Promise<string> | undefined;
  return async ({ token, title, body, data }) => {
    const access = await (accessToken ??= getAccessToken());
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
      signal: AbortSignal.timeout(8_000)
    });
    if (response.status === 404) {
      const failure = await response.json().catch(() => undefined) as { error?: { details?: Array<{ errorCode?: string }> } } | undefined;
      if (Array.isArray(failure?.error?.details) && failure.error.details.some(detail => detail.errorCode === "UNREGISTERED")) {
        return "UNREGISTERED";
      }
    } else {
      await response.body?.cancel().catch(() => {});
    }
    if (response.ok) return "SENT";
    return response.status === 401 || response.status === 403 || response.status === 408 || response.status === 429 ||
      response.status >= 500 ? "RETRY" : "FAILED";
  };
}

function eligibleNotification(target: PushTarget, data: Record<string, unknown>) {
  if (!target.token || target.is_blocked || target.deletion_requested_at) return false;
  if (data.type === "BONDS" && target.bond_notifications === 0) return false;
  const preference = preferenceForNotification(target.type, target.title, target.body, data);
  return !preference || target[preference] !== 0;
}

async function finishPush(db: D1Database, target: PushTarget, lease: string, now: Date, result: PushAttempt) {
  const status = result === "RETRY" && target.attempts < maxAttempts ? "PENDING" :
    result === "UNREGISTERED" || result === "SKIPPED" ? "SKIPPED" : result === "SENT" ? "SENT" : "FAILED";
  const due = new Date(now.getTime() + minute * 2 ** (target.attempts - 1)).toISOString();
  const claim = [target.notification_id, target.device_id, lease];
  const finish = db.prepare(`UPDATE notification_push_jobs SET status = ?, lease_id = NULL, due_at = ?
    WHERE notification_id = ? AND device_id = ? AND lease_id = ?`).bind(status, due, ...claim);

  if (result === "UNREGISTERED") {
    await db.batch([
      db.prepare(`DELETE FROM device_tokens WHERE source_id = ? AND token = ? AND EXISTS (
        SELECT 1 FROM notification_push_jobs WHERE notification_id = ? AND device_id = ? AND lease_id = ?
      )`).bind(target.device_id, target.token, ...claim),
      finish
    ]);
  } else {
    await finish.run();
  }
  return status;
}

export async function deliverD1PushJobs(db: D1Database, now: Date, send: PushSender) {
  const time = now.toISOString();
  const lease = crypto.randomUUID();
  const leaseUntil = new Date(now.getTime() + 2 * minute).toISOString();
  const claim = await db.prepare(`UPDATE notification_push_jobs SET attempts = attempts + 1, lease_id = ?, due_at = ?
    WHERE (notification_id, device_id) IN (SELECT notification_id, device_id FROM notification_push_jobs
      WHERE status = 'PENDING' AND due_at <= ? AND expires_at > ? AND attempts < ?
      ORDER BY due_at, notification_id, device_id LIMIT ?)`).bind(lease, leaseUntil, time, time, maxAttempts, claimSize).run();
  if (!claim.meta.changes) return;

  const { results } = await db.prepare(`SELECT j.notification_id, j.device_id, j.attempts, d.token,
    n.title, n.body, n.type, n.data, u.is_blocked, u.deletion_requested_at, u.bond_notifications,
    u.notification_preferences_room_invites AS roomInvites, u.notification_preferences_host_going_live AS hostGoingLive,
    u.notification_preferences_messages AS messages, u.notification_preferences_gifts AS gifts,
    u.notification_preferences_follows AS follows, u.notification_preferences_safety AS safety,
    u.notification_preferences_wallet AS wallet, u.notification_preferences_marketing AS marketing
    FROM notification_push_jobs AS j JOIN notifications AS n ON n.source_id = j.notification_id
    JOIN users AS u ON u.source_id = n.user_id LEFT JOIN device_tokens AS d ON d.source_id = j.device_id AND d.user_id = n.user_id
    WHERE j.lease_id = ?`).bind(lease).all<PushTarget>();

  const counts = { PENDING: 0, SENT: 0, SKIPPED: 0, FAILED: 0 };
  // Keep parallel outbound requests below the Worker's simultaneous connection limit.
  for (let offset = 0; offset < results.length; offset += 4) {
    await Promise.all(results.slice(offset, offset + 4).map(async target => {
      let result: PushAttempt = "FAILED";
      try {
        const data = target.data ? JSON.parse(target.data) as Record<string, unknown> : {};
        if (target.token && eligibleNotification(target, data)) {
          result = await send({ token: target.token, title: target.title, body: target.body,
            data: { ...stringifyNotificationData(data), notificationId: target.notification_id } }).catch(() => "RETRY");
        } else {
          result = "SKIPPED";
        }
      } finally {
        counts[await finishPush(db, target, lease, now, result)]++;
      }
    }));
  }
  console.info("D1 notification push delivery", counts);
}
