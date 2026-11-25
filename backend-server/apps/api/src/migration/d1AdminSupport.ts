import { ticketJson, type TicketRow } from "./d1SupportPresentation.js";
import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const respondSchema = z.object({ message: z.string().min(1).max(2000) });
const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().max(500).optional()
});

type MessageRow = {
  source_id: string;
  sender_id: string | null;
  sender_admin_id: string | null;
  sender_role: "USER" | "ADMIN";
  message: string;
  created_at: string;
  sender_json: string | null;
};

const userJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'username', ${alias}.username,
  'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;

function parseJson(value: string | null) {
  return value === null ? null : JSON.parse(value) as Record<string, unknown>;
}

function messageJson(row: MessageRow, populateSender: boolean) {
  return {
    _id: row.source_id,
    senderId: populateSender ? parseJson(row.sender_json) : row.sender_id ?? row.sender_admin_id,
    senderRole: row.sender_role,
    message: row.message,
    createdAt: row.created_at
  };
}

export function createD1AdminSupportRouter(db: D1Database, adminJwtSecret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, adminJwtSecret);

  const findTicket = (ticketId: string) => db.prepare("SELECT * FROM support_tickets WHERE source_id = ?")
    .bind(ticketId).first<TicketRow>();

  const readTicket = async (ticketId: string, populate: boolean) => {
    const row = await findTicket(ticketId);
    if (!row) throw new HttpError(404, "Ticket not found");
    const { results } = await db.prepare(`SELECT m.*, ${userJson("u")} AS sender_json
      FROM support_ticket_messages AS m LEFT JOIN users AS u ON u.source_id = m.sender_id
      WHERE m.support_tickets_id = ? ORDER BY m.position, m.source_id`).bind(ticketId).all<MessageRow>();
    let user: unknown;
    let assignee: unknown;
    if (populate && row.user_id) {
      user = parseJson((await db.prepare(`SELECT ${userJson("u")} AS json FROM users AS u WHERE source_id = ?`)
        .bind(row.user_id).first<{ json: string | null }>())?.json ?? null);
    }
    if (populate && row.assigned_to) {
      assignee = parseJson((await db.prepare(`SELECT json_object('_id', source_id, 'email', email) AS json
        FROM admin_users WHERE source_id = ?`).bind(row.assigned_to).first<{ json: string | null }>())?.json ?? null);
    }
    return ticketJson(row, results.map(message => messageJson(message, populate)), user, assignee);
  };

  router.get("/support/tickets", guard("support.read"), asyncHandler(async (req, res) => {
    const { skip, limit, page } = pageParams(req.query);
    const clauses: string[] = [];
    const params: string[] = [];
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const priority = typeof req.query.priority === "string" ? req.query.priority : "";
    const categories = Array.isArray(req.query.category)
      ? req.query.category.filter((value): value is string => typeof value === "string")
      : typeof req.query.category === "string" ? [req.query.category] : [];
    const q = typeof req.query.q === "string" ? req.query.q : "";
    if ((STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      clauses.push(`status = ?${params.length}`);
    }
    if ((PRIORITIES as readonly string[]).includes(priority)) {
      params.push(priority);
      clauses.push(`priority = ?${params.length}`);
    }
    if (categories.length) {
      const categoryClauses = categories.map(category => {
        params.push(category);
        return `category = ?${params.length}`;
      });
      clauses.push(`(${categoryClauses.join(" OR ")})`);
    }
    if (q) {
      params.push(q, q);
      clauses.push(`(instr(lower(subject), lower(?${params.length - 1})) > 0 OR instr(lower(message), lower(?${params.length})) > 0)`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = await db.prepare(`SELECT COUNT(*) AS count FROM support_tickets ${where}`)
      .bind(...params).first<{ count: number }>();
    const { results } = await db.prepare(`SELECT * FROM support_tickets ${where}
      ORDER BY updated_at DESC, source_id DESC LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`)
      .bind(...params, limit, skip).all<TicketRow>();
    const tickets = [];
    for (const row of results) {
      const { results: messages } = await db.prepare(`SELECT m.*, ${userJson("u")} AS sender_json
        FROM support_ticket_messages AS m LEFT JOIN users AS u ON u.source_id = m.sender_id
        WHERE m.support_tickets_id = ? ORDER BY m.position, m.source_id`).bind(row.source_id).all<MessageRow>();
      const user = row.user_id ? parseJson((await db.prepare(`SELECT ${userJson("u")} AS json FROM users AS u WHERE source_id = ?`)
        .bind(row.user_id).first<{ json: string | null }>())?.json ?? null) : undefined;
      const assignee = row.assigned_to ? parseJson((await db.prepare(`SELECT json_object('_id', source_id, 'email', email) AS json
        FROM admin_users WHERE source_id = ?`).bind(row.assigned_to).first<{ json: string | null }>())?.json ?? null) : undefined;
      tickets.push(ticketJson(row, messages.map(message => messageJson(message, false)), user, assignee));
    }
    adminOk(res, { tickets }, paginationMeta(page, limit, total?.count ?? 0));
  }));

  router.get("/support/tickets/:ticketId", guard("support.read"), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.ticketId)) throw new HttpError(400, "Invalid ticket ID", ErrorCode.VALIDATION);
    adminOk(res, { ticket: await readTicket(req.params.ticketId, true) });
  }));

  router.post("/support/tickets/:ticketId/respond", guard("support.reply"),
    validateBody(respondSchema), asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.ticketId)) throw new HttpError(400, "Invalid ticket ID", ErrorCode.VALIDATION);
      const admin = adminFrom(res);
      const row = await findTicket(req.params.ticketId);
      if (!row) throw new HttpError(404, "Ticket not found");
      const time = new Date().toISOString();
      await db.batch([
        db.prepare(`INSERT INTO support_ticket_messages
          (source_id, sender_id, sender_admin_id, sender_role, message, created_at, support_tickets_id, position)
          VALUES (?, NULL, ?, 'ADMIN', ?, ?, ?, (SELECT COALESCE(MAX(position) + 1, 0)
            FROM support_ticket_messages WHERE support_tickets_id = ?))`)
          .bind(newId(), admin.id, (req.body as { message: string }).message, time, row.source_id, row.source_id),
        db.prepare(`UPDATE support_tickets SET status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
          updated_at = ? WHERE source_id = ?`).bind(time, row.source_id)
      ]);
      await insertD1AdminAudit(db, admin, {
        action: "SUPPORT_RESPOND", entityType: "SupportTicket", entityId: row.source_id,
        metadata: { subject: row.subject }, req
      });
      adminOk(res, { ticket: await readTicket(row.source_id, false) });
    }));

  router.patch("/support/tickets/:ticketId/status", guard("support.reply"),
    validateBody(statusSchema), asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.ticketId)) throw new HttpError(400, "Invalid ticket ID", ErrorCode.VALIDATION);
      const admin = adminFrom(res);
      const body = req.body as { status: string; note?: string };
      const row = await findTicket(req.params.ticketId);
      if (!row) throw new HttpError(404, "Ticket not found");
      const time = new Date().toISOString();
      await db.prepare(`UPDATE support_tickets SET status = ?, resolved_at = ?, updated_at = ? WHERE source_id = ?`)
        .bind(body.status, body.status === "RESOLVED" ? time : row.resolved_at, time, row.source_id).run();
      await insertD1AdminAudit(db, admin, {
        action: "SUPPORT_STATUS_UPDATE", entityType: "SupportTicket", entityId: row.source_id,
        metadata: { status: body.status, note: body.note }, req
      });
      adminOk(res, { ticket: await readTicket(row.source_id, false) });
    }));

  router.patch("/support/tickets/:ticketId/assign", guard("support.reply"), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.ticketId)) throw new HttpError(400, "Invalid ticket ID", ErrorCode.VALIDATION);
    const admin = adminFrom(res);
    const requested = (req.body as { adminUserId?: string } | undefined)?.adminUserId;
    if (requested && !isValidObjectId(requested)) throw new HttpError(400, "Invalid admin user ID", ErrorCode.VALIDATION);
    const assignedTo = requested ?? admin.id;
    const row = await findTicket(req.params.ticketId);
    if (!row) throw new HttpError(404, "Ticket not found");
    await db.prepare("UPDATE support_tickets SET assigned_to = ?, updated_at = ? WHERE source_id = ?")
      .bind(assignedTo, new Date().toISOString(), row.source_id).run();
    await insertD1AdminAudit(db, admin, {
      action: "SUPPORT_ASSIGN", entityType: "SupportTicket", entityId: row.source_id,
      metadata: { assignedTo }, req
    });
    adminOk(res, { ticket: await readTicket(row.source_id, false) });
  }));

  router.get("/support/stats", guard("support.read"), asyncHandler(async (_req, res) => {
    const counts = await Promise.all(STATUSES.map(status =>
      db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE status = ?").bind(status).first<{ count: number }>()));
    const urgent = await db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE priority = 'URGENT' AND status <> 'CLOSED'")
      .first<{ count: number }>();
    const [open, inProgress, resolved, closed] = counts.map(count => count?.count ?? 0);
    adminOk(res, {
      stats: {
        open,
        inProgress,
        resolved,
        closed,
        urgent: urgent?.count ?? 0,
        total: open + inProgress + resolved + closed
      }
    });
  }));

  return router;
}
