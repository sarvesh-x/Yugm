import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { rollVipCycle, vipCycleNotice, VIP_CYCLE_DAYS } from "../services/vip.js";
import { closeExpiredD1Polls } from "./d1RoomPolls.js";
import type { D1LiveKitConfig } from "./d1LiveKit.js";

const dayMs = 86_400_000;
const uploadGraceMs = 15 * 60_000;
const staleRoomAfterMs = 2 * dayMs;
const rowLimit = 100;
const uploadLimit = 32;
// Leave room for the other jobs within the Workers Free D1 statement limit.
const vipLimit = 20;
const staleRoomLimit = 20;

type VipRow = {
  source_id: string; vip_tier: string | null; vip_level: number; vip_exp: number;
  vip_started_at: string | null; vip_expires_at: string | null; vip_frozen: number; vip_freeze_started_at: string | null;
};

export async function rollExpiredVipCycles(db: D1Database, now: Date) {
  const time = now.toISOString();
  const freezeThrough = new Date(now.getTime() - VIP_CYCLE_DAYS * dayMs).toISOString();
  const { results } = await db.prepare(`SELECT source_id, vip_tier, vip_level, vip_exp, vip_started_at,
    vip_expires_at, vip_frozen, vip_freeze_started_at FROM users WHERE
    (vip_frozen = 0 AND vip_tier IS NOT NULL AND vip_expires_at <= ?) OR
    (vip_frozen = 1 AND vip_freeze_started_at <= ?)
    ORDER BY CASE WHEN vip_frozen = 1 THEN vip_freeze_started_at ELSE vip_expires_at END, source_id LIMIT ?`)
    .bind(time, freezeThrough, vipLimit).all<VipRow>();
  if (!results.length) return 0;

  const guard = `source_id = ? AND vip_tier IS ? AND vip_level = ? AND vip_exp = ?
    AND vip_expires_at IS ? AND vip_frozen = ? AND vip_freeze_started_at IS ?`;
  const guardValues = (row: VipRow) => [row.source_id, row.vip_tier, row.vip_level, row.vip_exp,
    row.vip_expires_at, row.vip_frozen, row.vip_freeze_started_at];
  const updateIndices: number[] = [];
  let offset = 0;
  const statements = results.flatMap(row => {
    const date = (value: string | null) => value ? new Date(value) : undefined;
    const vip = {
      vipTier: row.vip_tier ?? undefined, vipLevel: row.vip_level, vipExp: row.vip_exp,
      vipStartedAt: date(row.vip_started_at), vipExpiresAt: date(row.vip_expires_at),
      vipFrozen: Boolean(row.vip_frozen), vipFreezeStartedAt: date(row.vip_freeze_started_at)
    };
    const beforeLevel = row.vip_level;
    rollVipCycle(vip, now);
    const nextValues = [vip.vipTier ?? null, vip.vipLevel, vip.vipExp, vip.vipStartedAt?.toISOString() ?? null,
      vip.vipExpiresAt?.toISOString() ?? null, Number(vip.vipFrozen), vip.vipFreezeStartedAt?.toISOString() ?? null];
    const statements = [db.prepare(`UPDATE users SET vip_tier = ?, vip_level = ?, vip_exp = ?, vip_started_at = ?,
      vip_expires_at = ?, vip_frozen = ?, vip_freeze_started_at = ?, updated_at = ?
      WHERE ${guard}`)
      .bind(...nextValues, time, ...guardValues(row))];
    updateIndices.push(offset);
    const notice = vipCycleNotice(beforeLevel, vip.vipLevel);
    if (notice) {
      statements.push(db.prepare(`INSERT INTO notifications
        (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ? FROM users WHERE ${guard}`)
        .bind(randomBytes(12).toString("hex"), row.source_id, notice.title, notice.body,
          JSON.stringify(notice.data), time, time, row.source_id, nextValues[0], nextValues[1],
          nextValues[2], nextValues[4], nextValues[5], nextValues[6]));
    }
    offset += statements.length;
    return statements;
  });
  const updated = await db.batch(statements);
  return updateIndices.reduce((count, index) => count + updated[index].meta.changes, 0);
}

async function sweepMediaUploads(db: D1Database, staging: R2Bucket, now: Date) {
  const time = now.toISOString();
  const idleThrough = new Date(now.getTime() - uploadGraceMs).toISOString();
  const expired = await db.prepare(`UPDATE media_upload_sessions SET status = 'EXPIRED', quota_reserved = 0, updated_at = ?
    WHERE source_id IN (SELECT source_id FROM media_upload_sessions WHERE expires_at <= ?
      AND (status = 'PENDING' OR (status = 'PROCESSING' AND updated_at <= ?)) ORDER BY expires_at, source_id LIMIT ?)`)
    .bind(time, time, idleThrough, uploadLimit).run();
  const { results } = await db.prepare(`SELECT source_id, staging_key FROM media_upload_sessions
    WHERE staging_cleaned_at IS NULL AND status IN ('CANCELLED', 'FAILED', 'EXPIRED', 'COMPLETED')
      AND expires_at <= ? AND updated_at <= ? ORDER BY expires_at, source_id LIMIT ?`)
    .bind(idleThrough, idleThrough, uploadLimit).all<{ source_id: string; staging_key: string }>();

  if (results.length) {
    await staging.delete(results.map(row => row.staging_key));
    await db.prepare(`UPDATE media_upload_sessions SET staging_cleaned_at = ? WHERE staging_cleaned_at IS NULL
      AND source_id IN (SELECT value FROM json_each(?))`).bind(time, JSON.stringify(results.map(row => row.source_id))).run();
  }
  return { expired: expired.meta.changes, stagingCleaned: results.length };
}

async function endStaleRooms(db: D1Database, now: Date, livekit: D1LiveKitConfig) {
  // Loaded lazily to keep the scheduled startup graph free of route bindings.
  const { endD1Room } = await import("./d1Rooms.js");
  const cutoff = new Date(now.getTime() - staleRoomAfterMs).toISOString();
  const { results } = await db.prepare(`SELECT source_id FROM rooms WHERE status = 'LIVE' AND created_at <= ?
    ORDER BY created_at, source_id LIMIT ?`).bind(cutoff, staleRoomLimit).all<{ source_id: string }>();
  const time = now.toISOString();
  let ended = 0;
  for (const row of results) {
    if (await endD1Room(db, row.source_id, time, livekit)) ended += 1;
  }
  return ended;
}

export async function runD1Maintenance(db: D1Database, now: Date, staging?: R2Bucket, livekit: D1LiveKitConfig = {}) {
  // Load after the Worker runtime has set YUGM_RUNTIME=cloudflare; d1Bonds imports env.ts.
  const { runD1BondMaintenance } = await import("./d1Bonds.js");
  const { purgeExpiredD1Accounts } = await import("./d1AccountDeletion.js");
  const time = now.toISOString();
  const clanCutoff = new Date(now.getTime() - 30 * dayMs).toISOString();
  const oldClanMessages = "SELECT source_id FROM clan_messages WHERE created_at <= ? ORDER BY created_at, source_id LIMIT ?";

  const [lifecycle, bonds, vip, media, rooms, accounts] = await Promise.allSettled([
    db.batch([
      db.prepare(`DELETE FROM auth_sessions WHERE source_id IN (SELECT source_id FROM auth_sessions
        WHERE expires_at <= ? ORDER BY expires_at, source_id LIMIT ?)`).bind(time, rowLimit),
      db.prepare(`DELETE FROM notification_push_jobs WHERE (notification_id, device_id) IN (
        SELECT notification_id, device_id FROM notification_push_jobs WHERE expires_at <= ? ORDER BY expires_at LIMIT ?)`)
        .bind(time, rowLimit),
      db.prepare(`UPDATE stories SET status = 'EXPIRED', updated_at = ? WHERE source_id IN (SELECT source_id FROM stories
        WHERE status = 'ACTIVE' AND expires_at <= ? ORDER BY expires_at, source_id LIMIT ?)`).bind(time, time, rowLimit),
      db.prepare(`UPDATE users SET suspended_until = NULL, moderation_reason = NULL, updated_at = ?
        WHERE source_id IN (SELECT source_id FROM users WHERE suspended_until <= ?
        ORDER BY suspended_until, source_id LIMIT ?)`).bind(time, time, rowLimit),
      db.prepare(`UPDATE clan_invites SET status = 'EXPIRED', updated_at = ? WHERE source_id IN (SELECT source_id FROM clan_invites
        WHERE status = 'PENDING' AND expires_at <= ? ORDER BY expires_at, source_id LIMIT ?)`).bind(time, time, rowLimit),
      db.prepare(`DELETE FROM clan_message_reactions WHERE clan_messages_id IN (${oldClanMessages})`).bind(clanCutoff, rowLimit),
      db.prepare(`DELETE FROM clan_messages WHERE source_id IN (${oldClanMessages})`).bind(clanCutoff, rowLimit),
      closeExpiredD1Polls(db, now, rowLimit)
    ]),
    runD1BondMaintenance(db, now),
    rollExpiredVipCycles(db, now),
    staging ? sweepMediaUploads(db, staging, now) : Promise.resolve({ expired: 0, stagingCleaned: 0 }),
    endStaleRooms(db, now, livekit),
    purgeExpiredD1Accounts(db, now)
  ]);

  console.info("D1 scheduled maintenance", {
    lifecycle: lifecycle.status === "fulfilled" ? lifecycle.value.map(result => result.meta.changes) : "failed",
    bonds: bonds.status === "fulfilled" ? "done" : "failed",
    vip: vip.status === "fulfilled" ? vip.value : "failed",
    media: media.status === "fulfilled" ? media.value : "failed",
    rooms: rooms.status === "fulfilled" ? rooms.value : "failed",
    accounts: accounts.status === "fulfilled" ? accounts.value : `failed: ${String(accounts.reason)}`
  });
  if (lifecycle.status === "rejected" || bonds.status === "rejected" || vip.status === "rejected" ||
      media.status === "rejected" || rooms.status === "rejected" || accounts.status === "rejected") {
    throw new Error("D1 scheduled maintenance has failed tasks");
  }
}
