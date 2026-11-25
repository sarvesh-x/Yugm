import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { presentNotification } from "./d1Notifications.js";

const message = z.object({
  title: z.string().min(1).max(120), body: z.string().min(1).max(500),
  type: z.enum(["FOLLOW", "GIFT", "ROOM_INVITE", "ROOM_LIVE", "SPEAKER_APPROVED", "MESSAGE", "MOMENT", "COMMENT",
    "SYSTEM", "FRIEND_REQUEST", "FRIEND_ACCEPT", "SUBSCRIPTION", "WAVE"]).default("SYSTEM"),
  payload: z.record(z.unknown()).optional()
});
const customAudience = z.object({
  city: z.string().min(1).optional(), role: z.string().min(1).optional(), vipTier: z.string().min(1).optional(),
  isVerified: z.boolean().optional()
}).strict();
const campaignSchema = message.pick({ title: true, body: true }).extend({
  title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(500),
  segment: z.enum(["all", "hosts", "city", "vip", "custom"]),
  segmentValue: z.string().optional(), filters: customAudience.optional(), scheduledFor: z.coerce.date().optional()
}).superRefine((campaign, ctx) => {
  if (campaign.segment === "city" && !campaign.segmentValue?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["segmentValue"], message: "City is required" });
  }
  if (campaign.segment === "custom" && !Object.keys(campaign.filters ?? {}).length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["filters"], message: "Custom audience requires a filter" });
  }
});

type Row = Record<string, string | number | null>;
const campaignQuery = `SELECT c.*, a.display_name AS creator_name
  FROM notification_campaigns c JOIN admin_users a ON a.source_id = c.created_by`;
function campaignJson(row: Row, populate = false) {
  return {
    _id: row.source_id, title: row.title, body: row.body, segment: row.segment,
    segmentValue: row.segment_value ?? undefined, filters: row.filters ? JSON.parse(String(row.filters)) : undefined,
    status: row.status, scheduledFor: row.scheduled_for ?? undefined, sentCount: row.sent_count,
    deliveredCount: row.delivered_count, openCount: row.open_count, clickCount: row.click_count,
    createdBy: populate ? { _id: row.created_by, displayName: row.creator_name } : row.created_by,
    sentAt: row.sent_at ?? undefined, completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

function campaignId(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid id", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

export function createD1AdminNotificationsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const canSend = createD1AdminGuard(db, secret)("notifications.send");
  const find = (id: string) => db.prepare(`${campaignQuery} WHERE c.source_id = ?`).bind(id).first<Row>();
  const addNotifications = `INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)`;

  router.post("/notifications/send-user", canSend, validateBody(message.extend({
    userId: z.string().refine(isValidObjectId, "Invalid userId")
  })), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof message> & { userId: string };
    const userId = body.userId.toLowerCase();
    const now = new Date().toISOString();
    const [created] = await db.batch<Parameters<typeof presentNotification>[0]>([
      db.prepare(`${addNotifications} SELECT ?, source_id, ?, ?, ?, ?, 0, ?, ? FROM users
        WHERE source_id = ? RETURNING *`).bind(newId(), body.type, body.title, body.body,
          JSON.stringify(body.payload ?? {}), now, now, userId),
      prepareD1AdminAudit(db, adminFrom(res), { action: "notification.sent_user", entityType: "notification",
        targetUserId: userId, metadata: body, req }, true)
    ]);
    if (!created.results[0]) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    adminOk(res, { notification: presentNotification(created.results[0]) });
  }));

  // Both immediate broadcasts write inbox rows and let the existing D1 trigger queue device delivery.
  const sendBroadcast = (all: boolean) => asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof message> & { segment?: string; city?: string };
    const { segment, city } = body;
    const role = segment === "hosts" ? "HOST" : null;
    const targetCity = segment === "city" ? city ?? null : null;
    const now = new Date().toISOString();
    const [created] = await db.batch([
      db.prepare(`${addNotifications} SELECT lower(hex(randomblob(12))), source_id, ?1, ?2, ?3, ?4, 0, ?5, ?5
        FROM users WHERE (?6 = 0 OR is_blocked = 0) AND (?7 IS NULL OR role = ?7) AND (?8 IS NULL OR city = ?8)
        ORDER BY source_id LIMIT ?9`)
        .bind(body.type, body.title, body.body, JSON.stringify(body.payload ?? {}), now, Number(all), role, targetCity, all ? 5000 : 1000),
      prepareD1AdminAudit(db, adminFrom(res), { action: all ? "notification.sent_all" : "notification.sent_segment",
        entityType: "notification_campaign", metadata: body, req })
    ]);
    adminOk(res, { sent: created.meta.changes });
  });
  router.post("/notifications/send-all", canSend, validateBody(message), sendBroadcast(true));
  router.post("/notifications/send-segment", canSend,
    validateBody(message.extend({ segment: z.enum(["hosts", "city"]), city: z.string().trim().min(1).optional() })
      .refine(body => body.segment !== "city" || body.city, { path: ["city"], message: "City is required" })),
    sendBroadcast(false));

  router.get("/notifications/campaigns", canSend, asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams({ limit: 50, ...req.query });
    const [items, count] = await db.batch<Row>([
      db.prepare(`${campaignQuery} ORDER BY c.created_at DESC, c.source_id LIMIT ? OFFSET ?`).bind(limit, skip),
      db.prepare("SELECT COUNT(*) AS total FROM notification_campaigns")
    ]);
    adminOk(res, { campaigns: items.results.map(row => campaignJson(row, true)) },
      paginationMeta(page, limit, Number(count.results[0]?.total ?? 0)));
  }));
  router.get("/notifications/campaigns/:id", canSend, asyncHandler(async (req, res) => {
    const row = await find(campaignId(req.params.id));
    if (!row) throw new HttpError(404, "Campaign not found", ErrorCode.NOT_FOUND);
    adminOk(res, { campaign: campaignJson(row, true) });
  }));
  router.post("/notifications/campaigns", canSend, validateBody(campaignSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof campaignSchema>;
    const id = newId();
    const admin = adminFrom(res);
    const now = new Date().toISOString();
    const [created] = await db.batch<Row>([
      db.prepare(`INSERT INTO notification_campaigns (source_id, title, body, segment, segment_value, filters, status,
        scheduled_for, sent_count, delivered_count, open_count, click_count, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, 0, 0, 0, 0, ?, ?, ?) RETURNING *`).bind(
          id, body.title, body.body, body.segment, body.segmentValue ?? null, body.filters ? JSON.stringify(body.filters) : null,
          body.scheduledFor?.toISOString() ?? null, admin.id, now, now),
      prepareD1AdminAudit(db, admin, { action: "notification.campaign.created", entityType: "notification_campaign",
        entityId: id, metadata: body, req })
    ]);
    adminOk(res, { campaign: campaignJson(created.results[0]) }, {}, 201);
  }));
  router.post("/notifications/campaigns/:id/cancel", canSend, asyncHandler(async (req, res) => {
    const id = campaignId(req.params.id);
    const row = await db.prepare(`UPDATE notification_campaigns SET status = 'CANCELLED', updated_at = ?
      WHERE source_id = ? AND status IN ('DRAFT', 'SCHEDULED', 'CANCELLED') RETURNING *`)
      .bind(new Date().toISOString(), id).first<Row>();
    if (!row) {
      if (!await find(id)) throw new HttpError(404, "Campaign not found", ErrorCode.NOT_FOUND);
      throw new HttpError(400, "Cannot cancel a campaign that is sending or sent", ErrorCode.VALIDATION);
    }
    adminOk(res, { campaign: campaignJson(row) });
  }));
  router.post("/notifications/campaigns/:id/send", canSend, asyncHandler(async (req, res) => {
    const id = campaignId(req.params.id);
    const campaign = await find(id);
    if (!campaign) throw new HttpError(404, "Campaign not found", ErrorCode.NOT_FOUND);
    const filters = customAudience.safeParse(campaign.filters ? JSON.parse(String(campaign.filters)) : {});
    if (campaign.segment === "custom" && (!filters.success || !Object.keys(filters.data).length)) {
      throw new HttpError(422, "Campaign uses unsupported custom audience filters", ErrorCode.VALIDATION);
    }
    if (campaign.segment === "city" && !String(campaign.segment_value ?? "").trim()) {
      throw new HttpError(422, "Campaign city is required", ErrorCode.VALIDATION);
    }
    const now = new Date().toISOString();
    const [created, sent] = await db.batch([
      db.prepare(`${addNotifications} SELECT lower(hex(randomblob(12))), u.source_id,
        'SYSTEM', c.title, c.body, json_object('campaignId', c.source_id), 0, ?2, ?2
        FROM notification_campaigns c CROSS JOIN users u WHERE c.source_id = ?1 AND c.status IN ('DRAFT', 'SCHEDULED')
        AND (c.segment = 'all' OR (u.is_blocked = 0 AND (
          (c.segment = 'hosts' AND u.role = 'HOST') OR (c.segment = 'city' AND u.city = c.segment_value)
          OR (c.segment = 'vip' AND u.vip_tier IS NOT NULL) OR (c.segment = 'custom'
            AND (c.filters ->> '$.city' IS NULL OR u.city = c.filters ->> '$.city')
            AND (c.filters ->> '$.role' IS NULL OR u.role = c.filters ->> '$.role')
            AND (c.filters ->> '$.vipTier' IS NULL OR u.vip_tier = c.filters ->> '$.vipTier')
            AND (c.filters ->> '$.isVerified' IS NULL OR u.is_verified = c.filters ->> '$.isVerified')))))
        ORDER BY u.source_id LIMIT 10000`).bind(id, now),
      db.prepare(`UPDATE notification_campaigns SET status = 'SENT', sent_count = changes(), delivered_count = changes(),
        sent_at = ?2, completed_at = ?2, updated_at = ?2
        WHERE source_id = ?1 AND status IN ('DRAFT', 'SCHEDULED')`).bind(id, now),
      prepareD1AdminAudit(db, adminFrom(res), { action: "notification.campaign.sent", entityType: "notification_campaign",
        entityId: id, metadata: { segment: campaign.segment }, req }, true)
    ]);
    if (!sent.meta.changes) throw new HttpError(400, "Campaign already sent or cancelled", ErrorCode.VALIDATION);
    adminOk(res, { sent: created.meta.changes, delivered: created.meta.changes });
  }));

  return router;
}
