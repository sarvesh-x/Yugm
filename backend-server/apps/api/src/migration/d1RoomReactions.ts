import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { legacyReactionTypes, reactionSchema } from "@yugm/shared";
import { Router } from "express";
import { createHttpSessionAuth, requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import {
  additionalDefaultReactions, isActiveVip, legacyReactionEmojis, legacyReactionLabels,
  normalizeReactionId, toPublicRoomReaction, type PublicRoomReaction
} from "../services/reactionCatalog.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { chatRestricted } from "./d1ChatModeration.js";

export interface ReactionRow {
  source_id: string;
  label: string;
  emoji: string;
  asset_url: string | null;
  asset_kind: PublicRoomReaction["assetKind"];
  access: PublicRoomReaction["access"];
  sort_order: number;
}

interface VipRow {
  vip_level: number;
  vip_tier: string | null;
  vip_expires_at: string | null;
  vip_frozen: number;
}

const defaults = JSON.stringify([
  ...legacyReactionTypes.map(id => ({
    id, label: legacyReactionLabels[id] ?? id, emoji: legacyReactionEmojis[id] ?? "",
    access: "EVERYONE", backfillEmoji: true
  })),
  ...additionalDefaultReactions
]);
const vipColumns = "u.vip_level, u.vip_tier, u.vip_expires_at, u.vip_frozen";
const participant = `EXISTS (SELECT 1 FROM room_participants
  WHERE room_id = r.source_id AND user_id = u.source_id AND left_at IS NULL)`;

function vipUser(row: VipRow | null) {
  return row && {
    vipTier: row.vip_tier, vipLevel: row.vip_level, vipExpiresAt: row.vip_expires_at, vipFrozen: Boolean(row.vip_frozen)
  };
}

export async function ensureDefaultReactions(db: D1Database) {
  const missing = await db.prepare(`SELECT 1 FROM json_each(?) AS t
    LEFT JOIN room_reactions AS r ON r.source_id = json_extract(t.value, '$.id')
    WHERE r.source_id IS NULL OR (r.emoji = '' AND json_extract(t.value, '$.backfillEmoji') = 1) LIMIT 1`)
    .bind(defaults).first();
  if (!missing) return;
  const time = new Date().toISOString();
  await db.prepare(`INSERT INTO room_reactions (source_id, label, emoji, asset_kind, access, is_active, sort_order, created_at, updated_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.label'), json_extract(value, '$.emoji'),
      'STATIC', json_extract(value, '$.access'), 1, key, ?, ? FROM json_each(?) WHERE 1
    ON CONFLICT (source_id) DO UPDATE SET emoji = excluded.emoji, updated_at = excluded.updated_at
      WHERE room_reactions.emoji = ''
        AND EXISTS (SELECT 1 FROM json_each(?) AS t WHERE json_extract(t.value, '$.id') = excluded.source_id
          AND json_extract(t.value, '$.backfillEmoji') = 1)`).bind(time, time, defaults, defaults).run();
}

export function createD1RoomReactionsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const { optional } = createHttpSessionAuth(access, (_req, res, user) => { res.locals.viewerId = user.id; });
  const authenticate = asyncHandler(async (req, res, next) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    res.locals.claims = claims;
    if (await db.prepare(`SELECT 1 FROM users AS u WHERE u.source_id = ? AND ${chatRestricted}`).bind(claims.sub).first()) {
      throw new HttpError(403, "Chat access restricted", ErrorCode.FORBIDDEN);
    }
    next();
  });

  router.get("/reactions", optional, asyncHandler(async (_req, res) => {
    await ensureDefaultReactions(db);
    const viewerId: string | undefined = res.locals.viewerId;
    const [catalog, vip] = await Promise.all([
      db.prepare("SELECT * FROM room_reactions WHERE is_active = 1 ORDER BY sort_order, created_at, source_id").all<ReactionRow>(),
      viewerId ? db.prepare(`SELECT ${vipColumns} FROM users AS u WHERE source_id = ?`).bind(viewerId).first<VipRow>() : null
    ]);
    sendOk(res, { reactions: catalog.results.map(row => toPublicRoomReaction({
      _id: row.source_id, label: row.label, emoji: row.emoji, assetUrl: row.asset_url,
      assetKind: row.asset_kind, sortOrder: row.sort_order, access: row.access
    }, vipUser(vip))) });
  }));

  router.post("/rooms/:id/reactions", authenticate, validateBody(reactionSchema), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    const roomId = req.params.id.toLowerCase();
    const claims: AccessClaims = res.locals.claims;
    const reactionId = normalizeReactionId(req.body.type);
    const state = await db.prepare(`SELECT r.status, ${participant} AS participating, ${vipColumns}
      FROM rooms AS r CROSS JOIN users AS u WHERE r.source_id = ? AND u.source_id = ?`)
      .bind(roomId, claims.sub).first<VipRow & { status: string; participating: number }>();
    if (!state) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    if (state.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    if (!state.participating) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);

    await ensureDefaultReactions(db);
    const reaction = await db.prepare("SELECT access FROM room_reactions WHERE source_id = ? AND is_active = 1")
      .bind(reactionId).first<Pick<ReactionRow, "access">>();
    if (!reaction) throw new HttpError(404, "Reaction not found", ErrorCode.NOT_FOUND);
    const vip = isActiveVip(vipUser(state));
    if (reaction.access === "VIP_EXCLUSIVE" && !vip) {
      throw new HttpError(403, "This reaction unlocks at VIP 3", ErrorCode.FORBIDDEN);
    }

    const time = new Date().toISOString();
    const row = await db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
      SELECT ?, r.source_id, u.source_id, 'REACTION', u.name || ' reacted with ' || COALESCE(NULLIF(c.label, ''), c.source_id),
        json_object('type', c.source_id, 'reactionId', c.source_id, 'label', c.label, 'emoji', c.emoji,
          'assetUrl', COALESCE(c.asset_url, ''), 'assetKind', c.asset_kind, 'access', c.access,
          'userId', u.source_id, 'name', u.name, 'at', ?), ?, ?
      FROM rooms AS r CROSS JOIN users AS u CROSS JOIN room_reactions AS c
      WHERE r.source_id = ? AND r.status = 'LIVE' AND c.source_id = ? AND c.is_active = 1
        AND ${d1LiveUserFilter} AND ${participant} AND NOT ${chatRestricted}
        AND (c.access = 'EVERYONE' OR (? = 1 AND u.vip_tier IS ? AND u.vip_level = ? AND u.vip_frozen = 0
          AND u.vip_expires_at IS ? AND u.vip_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
      RETURNING metadata`)
      .bind(randomBytes(12).toString("hex"), time, time, time, roomId, reactionId, ...bindD1LiveUser(claims, time),
        Number(vip), state.vip_tier, state.vip_level, state.vip_expires_at).first<{ metadata: string }>();
    if (!row) {
      await requireHttpSession(req.headers.authorization, access);
      throw new HttpError(409, "Room or reaction access changed. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { reaction: JSON.parse(row.metadata) }, 201);
  }));
  return router;
}
