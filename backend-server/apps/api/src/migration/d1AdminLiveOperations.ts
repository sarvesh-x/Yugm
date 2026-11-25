import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { pkBattleJoins, pkBattleProjection, presentPkBattle, type BattleRow } from "./d1RoomPkHistory.js";

const key = (value: string, label: string) => {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return value.toLowerCase();
};
const reason = z.object({ reason: z.string().min(3).max(500) });
const selectBattles = `SELECT ${pkBattleProjection} FROM pk_battles b ${pkBattleJoins}`;
type Row = Record<string, string | number | null>;
const missingBattle = () => new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);

export function createD1AdminLiveOperationsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const canRead = guard("rooms.read");
  router.get("/pk/battles", canRead, asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
    const { results } = await db.prepare(`${selectBattles} WHERE (?1 IS NULL OR b.status = ?1)
      ORDER BY b.created_at DESC, b.source_id LIMIT 100`).bind(status).all<BattleRow>();
    const time = Date.now();
    adminOk(res, results.map(battle => presentPkBattle(battle, time)));
  }));
  router.get("/pk/battles/live", canRead, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`${selectBattles} WHERE b.status = 'ACTIVE'
      ORDER BY b.started_at DESC, b.source_id LIMIT 100`).all<BattleRow>();
    const time = Date.now();
    adminOk(res, results.map(battle => presentPkBattle(battle, time)));
  }));
  router.get("/pk/battles/:battleId", canRead, asyncHandler(async (req, res) => {
    const row = await db.prepare(`${selectBattles} WHERE b.source_id = ?`)
      .bind(key(req.params.battleId, "battleId")).first<BattleRow>();
    if (!row) throw missingBattle();
    adminOk(res, { battle: presentPkBattle(row) });
  }));
  router.get("/pk/battles/:battleId/events", canRead, asyncHandler(async (req, res) => {
    const { results } = await db.prepare(`SELECT source_id AS _id, battle_id AS battleId, room_id AS roomId,
      user_id AS userId, event_type AS eventType, side, points, state_version AS stateVersion,
      sequence, gift_transaction_id AS giftTransactionId, metadata, created_at AS createdAt
      FROM pk_events WHERE battle_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 200`)
      .bind(key(req.params.battleId, "battleId")).all<Row>();
    adminOk(res, results.map(row => ({ ...row, metadata: JSON.parse(String(row.metadata ?? "{}")) as unknown })));
  }));
  router.post("/pk/battles/:battleId/flag", guard("reports.resolve"), validateBody(reason), asyncHandler(async (req, res) => {
    const id = key(req.params.battleId, "battleId");
    const admin = adminFrom(res);
    const auditId = newId();
    if (!await db.prepare("SELECT 1 FROM pk_battles WHERE source_id = ?").bind(id).first()) throw missingBattle();
    await prepareD1AdminAudit(db, admin, { auditId, action: "pk.flagged", entityType: "pk_battle", entityId: id,
      metadata: { reason: req.body.reason }, req }).run();
    const log = await db.prepare("SELECT created_at FROM admin_audit_logs WHERE source_id = ?").bind(auditId).first<string>("created_at");
    adminOk(res, { flagged: true, auditLog: { _id: auditId, adminId: admin.id, action: "pk.flagged",
      entityType: "pk_battle", entityId: id, metadata: { reason: req.body.reason }, createdAt: log } });
  }));
  router.post("/pk/battles/:battleId/end", guard("rooms.end"), validateBody(reason.partial()), asyncHandler(async (req, res) => {
    const id = key(req.params.battleId, "battleId");
    const admin = adminFrom(res);
    const auditId = newId();
    const time = new Date().toISOString();
    const termination = req.body.reason ?? "Admin force end";
    const updated = `EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?)`;
    const [, , , snapshot] = await db.batch<BattleRow>([
      db.prepare(`UPDATE pk_battles SET status = 'ABORTED', ended_at = ?1, finalized_at = ?1, updated_at = ?1,
        winner_side = CASE WHEN left_score > right_score THEN 'LEFT' WHEN right_score > left_score THEN 'RIGHT' ELSE 'DRAW' END,
        winner_user_id = CASE WHEN left_score > right_score THEN left_host_id WHEN right_score > left_score THEN right_host_id END,
        termination_reason = ?2, event_sequence = event_sequence + 2, state_version = state_version + 1 WHERE source_id = ?3
        AND status IN ('INVITED','WAITING','PREPARING','READY','COUNTDOWN','ACTIVE','FINAL_CRUNCH','FINALIZING','OVERTIME')`)
        .bind(time, termination, id),
      prepareD1AdminAudit(db, admin, { auditId, action: "pk.force_ended", entityType: "pk_battle", entityId: id,
        metadata: { reason: termination }, req }, true),
      db.prepare(`INSERT INTO pk_events (source_id, battle_id, event_type, side, points, state_version, sequence, metadata, created_at)
        SELECT ?, source_id, 'PK_ABORTED', winner_side, 0, state_version, event_sequence - 1, ?, ?
        FROM pk_battles WHERE source_id = ? AND ${updated}`)
        .bind(newId(), JSON.stringify({ reason: termination }), time, id, auditId),
      db.prepare(`${selectBattles} WHERE b.source_id = ?`).bind(id),
      db.prepare(`UPDATE pk_battles SET status = 'CLOSED', closed_at = ?, updated_at = ?, state_version = state_version + 1
        WHERE source_id = ? AND ${updated}`).bind(time, time, id, auditId),
      db.prepare(`INSERT INTO pk_events (source_id, battle_id, event_type, points, state_version, sequence, metadata, created_at)
        SELECT ?, source_id, 'PK_CLOSED', 0, state_version, event_sequence, '{}', ? FROM pk_battles WHERE source_id = ? AND ${updated}`)
        .bind(newId(), time, id, auditId),
      db.prepare(`UPDATE rooms SET active_pk_id = NULL, updated_at = ? WHERE active_pk_id = ? AND ${updated}`).bind(time, id, auditId)
    ]);
    const battle = snapshot.results[0];
    if (!battle) throw missingBattle();
    adminOk(res, { battle: presentPkBattle(battle) });
  }));
  router.post("/clans/:clanId/clean-messages", guard("messages.delete", "reports.resolve"), asyncHandler(async (req, res) => {
    const id = key(req.params.clanId, "clan ID");
    if (!await db.prepare("SELECT 1 FROM clans WHERE source_id = ?").bind(id).first()) {
      throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
    }
    const admin = adminFrom(res);
    const [, removed] = await db.batch([
      db.prepare("DELETE FROM clan_message_reactions WHERE clan_messages_id IN (SELECT source_id FROM clan_messages WHERE clan_id = ?)")
        .bind(id),
      db.prepare("DELETE FROM clan_messages WHERE clan_id = ?").bind(id),
      prepareD1AdminAudit(db, admin, { action: "clan.clean_messages", entityType: "clan", entityId: id, req })
    ]);
    adminOk(res, { deletedCount: removed.meta.changes });
  }));
  return router;
}
