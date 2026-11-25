import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import type { z } from "zod";
import { authClientIpHeader } from "../middleware/authRateLimitKeys.js";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { addMessageSchema, createTicketSchema, publicRequestSchema } from "../services/supportContract.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { ticketJson, type TicketRow } from "./d1SupportPresentation.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

type Thread = TicketRow & { messages_json: string };
const id = () => randomBytes(12).toString("hex");
const liveOwner = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL)`;
const readThread = `SELECT t.*, (SELECT json_group_array(json_object('_id', source_id, 'senderId', COALESCE(sender_id, sender_admin_id),
  'senderRole', sender_role, 'message', message, 'createdAt', created_at)) FROM (
    SELECT * FROM support_ticket_messages WHERE support_tickets_id = t.source_id ORDER BY position, source_id
  )) AS messages_json FROM support_tickets AS t`;
const ticketNotFound = () => new HttpError(404, "Ticket not found", ErrorCode.VALIDATION);
const present = (row: Thread) => ticketJson(row, JSON.parse(row.messages_json));

export async function createD1OwnedTicket(db: D1Database, claims: AccessClaims, input: {
  subject: string; message: string; category: string; priority: string;
}, trackLastMessage = false) {
  const ticket = id();
  const time = new Date().toISOString();
  const [created, , stored] = await db.batch<Thread>([
    db.prepare(`INSERT INTO support_tickets (source_id, user_id, subject, message, category, priority, status,
      last_message_at, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ? WHERE ${liveOwner}`)
      .bind(ticket, claims.sub, input.subject, input.message, input.category, input.priority,
        trackLastMessage ? time : null, time, time, ...bindD1LiveUser(claims, time)),
    db.prepare(`INSERT INTO support_ticket_messages (source_id, sender_id, sender_role, message, created_at, support_tickets_id, position)
      SELECT ?, user_id, 'USER', message, created_at, source_id, 0 FROM support_tickets WHERE source_id = ?`).bind(id(), ticket),
    db.prepare(`${readThread} WHERE t.source_id = ?`).bind(ticket)
  ]);
  if (!created.meta.changes) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  return present(stored.results[0]);
}

function ticketId(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid ticket ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

export function createD1SupportRouter(db: D1Database, publicRequestLimit?: D1UserRateLimit) {
  const router = Router();
  const reader = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, reader);
  const requireOwner = asyncHandler(async (req, res, next) => {
    res.locals.supportSession = await authenticate(req);
    next();
  });
  const readOwned = async (owner: string, ticket: string) => {
    const row = await db.prepare(`${readThread} WHERE t.user_id = ? AND t.source_id = ?`).bind(owner, ticket).first<Thread>();
    if (!row) throw ticketNotFound();
    return row;
  };

  router.post("/public-requests", asyncHandler(async (req, res, next) => {
    await enforceD1UserRateLimit(publicRequestLimit, req.get(authClientIpHeader) ?? "unknown", res, 60);
    next();
  }), validateBody(publicRequestSchema), asyncHandler(async (req, res) => {
    const { email, username, subject, message, requestType } = req.body as z.infer<typeof publicRequestSchema>;
    const deletion = requestType === "ACCOUNT_DELETION";
    const requestId = id();
    const time = new Date().toISOString();
    await db.prepare(`INSERT INTO support_tickets (source_id, requester_email, category, subject, message, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`)
      .bind(requestId, email, requestType === "SUPPORT" ? "General" : "Account",
        deletion ? `Account deletion request: ${subject}` : subject,
        [username ? `Username: ${username}` : "", `Request type: ${requestType}`, message].filter(Boolean).join("\n\n"),
        deletion ? "HIGH" : "MEDIUM", time, time).run();
    sendOk(res, { requestId, received: true }, 201);
  }));

  router.post("/tickets", requireOwner, validateBody(createTicketSchema), asyncHandler(async (req, res) => {
    const { claims } = res.locals.supportSession as Awaited<ReturnType<typeof authenticate>>;
    sendOk(res, { ticket: await createD1OwnedTicket(db, claims, req.body as z.infer<typeof createTicketSchema>) }, 201);
  }));

  router.get("/tickets", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const page = Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Number.parseInt(String(req.query.page), 10) || 1));
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit), 10) || 20));
    const status = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].find(value => value === req.query.status);
    const where = status ? "t.user_id = ? AND t.status = ?" : "t.user_id = ?";
    const params = status ? [user.id, status] : [user.id];
    const [tickets, count] = await db.batch<Thread | { total: number }>([
      db.prepare(`${readThread} WHERE ${where} ORDER BY t.updated_at DESC, t.source_id DESC LIMIT ? OFFSET ?`)
        .bind(...params, limit, Math.min(Number.MAX_SAFE_INTEGER, (page - 1) * limit)),
      db.prepare(`SELECT COUNT(*) AS total FROM support_tickets AS t WHERE ${where}`).bind(...params)
    ]);
    const total = (count.results[0] as { total: number }).total;
    sendOk(res, { tickets: (tickets.results as Thread[]).map(present), total, page, totalPages: Math.ceil(total / limit) });
  }));

  router.get("/tickets/:ticketId", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    sendOk(res, { ticket: present(await readOwned(user.id, ticketId(req.params.ticketId))) });
  }));

  router.post("/tickets/:ticketId/messages", requireOwner, validateBody(addMessageSchema), asyncHandler(async (req, res) => {
    const { user, claims } = res.locals.supportSession as Awaited<ReturnType<typeof authenticate>>;
    const ticket = ticketId(req.params.ticketId);
    const messageId = id();
    const time = new Date().toISOString();
    const [added] = await db.batch([
      db.prepare(`INSERT INTO support_ticket_messages (source_id, sender_id, sender_role, message, created_at, support_tickets_id, position)
        SELECT ?, t.user_id, 'USER', ?, ?, t.source_id, COALESCE((SELECT MAX(position) + 1 FROM support_ticket_messages
          WHERE support_tickets_id = t.source_id), 0) FROM support_tickets AS t
        WHERE t.source_id = ? AND t.user_id = ? AND t.status <> 'CLOSED' AND ${liveOwner}`)
        .bind(messageId, req.body.message, time, ticket, user.id, ...bindD1LiveUser(claims, time)),
      db.prepare(`UPDATE support_tickets SET status = CASE WHEN status = 'RESOLVED' THEN 'OPEN' ELSE status END, updated_at = ?
        WHERE source_id = ? AND EXISTS (SELECT 1 FROM support_ticket_messages WHERE source_id = ?)`).bind(time, ticket, messageId)
    ]);
    if (!added.meta.changes) await authenticate(req);
    const row = await readOwned(user.id, ticket);
    if (!added.meta.changes) throw new HttpError(400, "Ticket is closed", ErrorCode.VALIDATION);
    sendOk(res, { ticket: present(row) });
  }));

  router.post("/tickets/:ticketId/close", asyncHandler(async (req, res) => {
    const { user, claims } = await authenticate(req);
    const ticket = ticketId(req.params.ticketId);
    const time = new Date().toISOString();
    const result = await db.prepare(`UPDATE support_tickets SET status = 'CLOSED', updated_at = ?
      WHERE source_id = ? AND user_id = ? AND ${liveOwner}`).bind(time, ticket, user.id, ...bindD1LiveUser(claims, time)).run();
    if (!result.meta.changes) {
      await authenticate(req);
      throw ticketNotFound();
    }
    sendOk(res, { ticket: present(await readOwned(user.id, ticket)) });
  }));
  return router;
}
