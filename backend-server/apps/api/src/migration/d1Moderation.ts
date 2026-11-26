import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { moderateContent } from "../services/contentModeration.js";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";

const checkTextSchema = z.object({
  text: z.string().min(1).max(2000),
  context: z.enum(["chat", "profile", "room_title", "room_description", "clan", "message"]).optional().default("chat")
});

const reportSchema = z.object({
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  messageId: z.string().optional(),
  category: z.enum(["harassment", "spam", "nudity", "hate_speech", "violence", "scam", "impersonation", "other"]),
  description: z.string().max(1000).optional()
});

const appealSchema = z.object({
  actionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  reason: z.string().min(10).max(2000)
});

type Row = Record<string, string | number | null>;

const toxicityScores = (includeSexuallyExplicit: boolean) => ({
  toxicity: 0,
  severeToxicity: 0,
  identityAttack: 0,
  insult: 0,
  threat: 0,
  ...(includeSexuallyExplicit ? { sexuallyExplicit: 0 } : {})
});

export function createD1ModerationRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const requireModerationSession = asyncHandler(async (req, res, next) => {
    await requireHttpSession(req.headers.authorization, access);
    next();
  });

  router.post("/v1/moderation/check-text", requireModerationSession, asyncHandler(async (req, res) => {
    const parsed = checkTextSchema.safeParse(req.body);
    // The legacy router calls Zod's parse directly, so malformed input reaches
    // its generic error handler as a 500 INTERNAL with the Zod issue text. The
    // shared D1 handler masks 500 messages, so preserve that body here.
    if (!parsed.success) {
      res.status(500).json({
        ok: false,
        error: { message: parsed.error.message, code: "INTERNAL", requestId: crypto.randomUUID() }
      });
      return;
    }
    const { text, context } = parsed.data;
    const result = moderateContent(text);
    const isFlagged = !result.isClean;

    sendOk(res, {
      text,
      context,
      isClean: !isFlagged,
      isBlocked: result.action === "BLOCK",
      severity: result.severity,
      keywordFlags: result.flaggedWords,
      aiFlags: [],
      toxicityScores: toxicityScores(true),
      topLabel: null,
      aiModelReady: false,
      aiModelLoading: false
    });
  }));

  router.post("/v1/moderation/check-voice", requireModerationSession, asyncHandler(async (req, res) => {
    const { transcript } = req.body as { transcript?: unknown };
    if (!transcript || typeof transcript !== "string") {
      res.status(400).json({ ok: false, error: { message: "Transcript is required" } });
      return;
    }

    const result = moderateContent(transcript);
    sendOk(res, {
      transcript,
      isClean: result.isClean,
      severity: result.severity,
      keywordFlags: result.flaggedWords,
      aiFlags: [],
      toxicityScores: toxicityScores(false)
    });
  }));

  router.post("/v1/moderation/report", requireModerationSession, asyncHandler(async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(500).json({
        ok: false,
        error: { message: parsed.error.message, code: "INTERNAL", requestId: crypto.randomUUID() }
      });
      return;
    }
    const { targetUserId, roomId, messageId, category, description } = parsed.data;
    const target = targetUserId?.toLowerCase() ?? null;
    const room = roomId?.toLowerCase() ?? null;
    const targetId = target ?? room ?? messageId ?? null;
    if (!targetId) {
      throw new HttpError(400, "A report target is required", ErrorCode.VALIDATION);
    }
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const now = new Date().toISOString();
    const reportId = newId();
    const queueId = newId();
    const priority = category === "violence" || category === "nudity" ? "HIGH" : "MEDIUM";
    const targetType = target ? "USER" : room ? "ROOM" : "MESSAGE";

    await db.batch([
      db.prepare(`INSERT INTO reports (source_id, reporter_id, target_user_id, room_id, reason, description, evidence,
        risk_score, auto_flagged, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'PENDING', ?, ?)`)
        .bind(reportId, claims.sub, target, room, category, description ?? "", JSON.stringify(messageId ? { messageId } : {}), now, now),
      db.prepare(`INSERT INTO moderation_queues (source_id, report_id, target_type, target_id, target_user_id,
        priority, status, reason, ai_score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, ?)`)
        .bind(queueId, reportId, targetType, targetId, target, priority, category, now, now)
    ]);

    sendOk(res, { reportId, queueId, status: "PENDING" }, 201);
  }));

  router.post("/v1/moderation/appeal", requireModerationSession, asyncHandler(async (req, res) => {
    const parsed = appealSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(500).json({
        ok: false,
        error: { message: parsed.error.message, code: "INTERNAL", requestId: crypto.randomUUID() }
      });
      return;
    }
    const { actionId, reason } = parsed.data;
    if (!isValidObjectId(actionId)) throw new HttpError(400, "Invalid action ID", ErrorCode.VALIDATION);
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const action = await db.prepare("SELECT target_user_id AS targetUserId, action FROM moderation_actions WHERE source_id = ?")
      .bind(actionId.toLowerCase()).first<{ targetUserId: string; action: string }>();
    if (!action) throw new HttpError(404, "Moderation action not found", ErrorCode.NOT_FOUND);
    if (action.targetUserId !== claims.sub) {
      throw new HttpError(403, "You can only appeal your own actions", ErrorCode.FORBIDDEN);
    }
    if (action.action === "UNBAN") {
      throw new HttpError(400, "Cannot appeal an already resolved action", ErrorCode.VALIDATION);
    }
    const queueId = newId();
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO moderation_queues (source_id, target_type, target_id, target_user_id,
      priority, status, reason, notes, ai_score, created_at, updated_at)
      VALUES (?, 'USER', ?, ?, 'HIGH', 'PENDING', ?, ?, 0, ?, ?)`)
      .bind(queueId, claims.sub, claims.sub, `Appeal: ${reason.slice(0, 80)}`, reason, now, now).run();
    sendOk(res, { appealId: queueId, status: "PENDING_REVIEW" });
  }));

  router.get("/v1/moderation/status", requireModerationSession, asyncHandler(async (req, res) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const [safety, user, actions, activeQueue] = await Promise.all([
      db.prepare(`SELECT trust_score, risk_level, is_shadow_banned, is_chat_restricted, is_room_restricted,
        is_wallet_frozen, warning_count, report_count, suspension_count
        FROM user_safety_statuses WHERE user_id = ?`).bind(claims.sub).first<Row>(),
      db.prepare("SELECT moderation_strikes, moderation_reason FROM users WHERE source_id = ?").bind(claims.sub)
        .first<{ moderation_strikes: number | null; moderation_reason: string | null }>(),
      db.prepare(`SELECT source_id AS id, action, reason, automated, created_at AS createdAt, expires_at AS expiresAt
        FROM moderation_actions WHERE target_user_id = ? ORDER BY created_at DESC, source_id LIMIT 10`)
        .bind(claims.sub).all<Row>(),
      db.prepare("SELECT COUNT(*) AS count FROM moderation_queues WHERE target_user_id = ? AND status = 'PENDING'")
        .bind(claims.sub).first<{ count: number }>()
    ]);
    sendOk(res, {
      trustScore: safety?.trust_score ?? 100,
      riskLevel: safety?.risk_level ?? "LOW",
      isShadowBanned: Boolean(safety?.is_shadow_banned),
      isChatRestricted: Boolean(safety?.is_chat_restricted),
      isRoomRestricted: Boolean(safety?.is_room_restricted),
      isWalletFrozen: Boolean(safety?.is_wallet_frozen),
      moderationStrikes: user?.moderation_strikes ?? 0,
      moderationReason: user?.moderation_reason ?? null,
      warningCount: safety?.warning_count ?? 0,
      reportCount: safety?.report_count ?? 0,
      suspensionCount: safety?.suspension_count ?? 0,
      pendingAppeals: activeQueue?.count ?? 0,
      recentActions: actions.results.map(row => ({
        id: row.id, action: row.action, reason: row.reason, automated: Boolean(row.automated),
        createdAt: row.createdAt, expiresAt: row.expiresAt
      }))
    });
  }));

  return router;
}
