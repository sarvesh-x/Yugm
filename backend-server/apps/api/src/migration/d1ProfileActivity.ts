import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, sanitizeText, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { d1UserId, person, personJson, visiblePerson } from "./d1People.js";
import { createD1OwnedTicket } from "./d1Support.js";

const feedback = z.object({
  category: z.enum(["LOGIN", "PAYMENT", "WITHDRAWAL", "ROOM", "CHAT", "MATCHING", "SAFETY", "REPORT", "BUG", "OTHER"]).default("OTHER"),
  subject: z.string().min(3).max(120),
  message: z.string().min(5).max(1200)
});
const supportCategory: Record<z.infer<typeof feedback>["category"], string> = {
  LOGIN: "Account", PAYMENT: "Payment", WITHDRAWAL: "Payment", ROOM: "General", CHAT: "General",
  MATCHING: "General", SAFETY: "Report", REPORT: "Report", BUG: "Technical", OTHER: "Other"
};

export function createD1ProfileActivityRouter(db: D1Database) {
  const router = Router();
  const readSession = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, readSession);
  router.get("/:id/stats", asyncHandler(async (req, res) => {
    await authenticate(req);
    const userId = d1UserId(req.params.id);
    const stats = await db.prepare(`SELECT COUNT(*) AS roomsHosted, COUNT(*) FILTER (WHERE status = 'LIVE') AS roomsLive
      FROM rooms WHERE host_id = ?`).bind(userId).first<{ roomsHosted: number; roomsLive: number }>();
    sendOk(res, stats);
  }));
  router.get("/:id/visitors", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    if (d1UserId(req.params.id) !== user.id) throw new HttpError(403, "You can only view your own visitors", ErrorCode.FORBIDDEN);
    const account = await db.prepare(`SELECT vip_tier AS vipTier, vip_level AS vipLevel, vip_expires_at AS vipExpiresAt, vip_frozen AS vipFrozen
      FROM users WHERE source_id = ?`).bind(user.id).first();
    if (!getVipStatus(account).isVip) throw new HttpError(403, "All Visitors is a VIP benefit", ErrorCode.FORBIDDEN);
    const visitors = await db.prepare(`SELECT ${personJson("visitor")} AS profile, v.last_visited_at AS visitedAt,
        visitor.followers_count AS followersCount, visitor.vip_level AS vipLevel, visitor.vip_exp AS vipExp
        FROM profile_visits v JOIN users visitor ON visitor.source_id = v.visitor_id
        WHERE v.profile_id = ?1 AND ${visiblePerson("visitor", "?1")}
        ORDER BY v.last_visited_at DESC, v.source_id DESC LIMIT 100`).bind(user.id)
      .all<{ profile: string; visitedAt: string; followersCount: number; vipLevel: number; vipExp: number }>();
    sendOk(res, { users: visitors.results.map(({ profile, ...fields }) => ({ ...person(profile), ...fields })) });
  }));
  router.post("/me/feedback", asyncHandler(async (req, res, next) => {
    res.locals.feedbackSession = await authenticate(req);
    next();
  }), validateBody(feedback), asyncHandler(async (req, res) => {
    const { claims } = res.locals.feedbackSession as Awaited<ReturnType<typeof authenticate>>;
    const body = req.body as z.infer<typeof feedback>;
    const subject = sanitizeText(body.subject);
    const message = sanitizeText(body.message);
    if (!subject.trim() || !message.trim()) throw new HttpError(400, "Feedback cannot be empty", ErrorCode.VALIDATION);
    sendOk(res, { ticket: await createD1OwnedTicket(db, claims, {
      subject, message, category: supportCategory[body.category], priority: "MEDIUM"
    }, true) }, 201);
  }));
  return router;
}
