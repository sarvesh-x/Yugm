import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  coverImage: z.string().optional(),
  category: z.string().min(1),
  type: z.enum(["ROOM", "TOURNAMENT", "SPECIAL", "WORKSHOP", "PARTY"]),
  eventDate: z.coerce.date(),
  eventEndDate: z.coerce.date().optional(),
  timezone: z.string().optional(),
  roomId: z.string().optional(),
  maxParticipants: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  festival: z.enum(["none", "diwali", "holi", "new_year", "valentines", "independence_day"]).default("none").optional(),
  featured: z.boolean().default(false).optional()
});

type CreateEvent = z.infer<typeof createSchema>;

type EventRow = {
  source_id: string;
  title: string;
  description: string | null;
  host_id: string;
  cover_image: string | null;
  category: string;
  type: string;
  event_date: string;
  event_end_date: string | null;
  timezone: string | null;
  room_id: string | null;
  max_participants: number | null;
  tags: string;
  status: string;
  festival: string;
  featured: number;
  created_at: string | null;
  updated_at: string | null;
  host_json: string | null;
  participant_json: string | null;
  participant_ids: string | null;
};

type PresentedEvent = Record<string, unknown> & {
  _id: string;
  title: string;
  status: string;
  hostId: unknown;
  participantIds: unknown;
};

const eventColumns = `e.source_id, e.title, e.description, e.host_id, e.cover_image, e.category, e.type,
  e.event_date, e.event_end_date, e.timezone, e.room_id, e.max_participants, e.tags, e.status,
  e.festival, e.featured, e.created_at, e.updated_at`;

// The legacy populated projection selects only these fields from host and participant users.
const eventPersonJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'name', ${alias}.name,
  'username', ${alias}.username, 'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;

const eventSelect = `SELECT ${eventColumns},
  (SELECT ${eventPersonJson("host")} FROM users AS host WHERE host.source_id = e.host_id) AS host_json,
  (SELECT json_group_array(${eventPersonJson("peer")}) FROM (
    SELECT u.source_id, u.name, u.username, u.avatar, u.avatar_type,
      ${AVATAR_PART_KEYS.map(key => `u.avatar_parts_${key}`).join(", ")}
    FROM event_participants AS p JOIN users AS u ON u.source_id = p.value
    WHERE p.events_id = e.source_id ORDER BY p.position, p.source_id
  ) AS peer) AS participant_json,
  (SELECT json_group_array(ids.value) FROM (
    SELECT p.value FROM event_participants AS p
    WHERE p.events_id = e.source_id ORDER BY p.position, p.source_id
  ) AS ids) AS participant_ids
  FROM events AS e`;

function eventId(value: string, message = "Invalid event ID") {
  if (!isValidObjectId(value)) throw new HttpError(400, message, ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function presentPerson(person: Record<string, unknown>) {
  const { avatarParts, ...fields } = person;
  const present = (value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));
  const parts = present((avatarParts ?? {}) as Record<string, unknown>);
  return {
    ...present(fields),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function parsePerson(record: string | null | undefined) {
  if (!record) return null;
  return presentPerson(JSON.parse(record) as Record<string, unknown>);
}

function presentEvent(row: EventRow, populateHost: boolean, populateParticipants: boolean): PresentedEvent {
  const participants = JSON.parse(row.participant_json ?? "[]") as Array<Record<string, unknown>>;
  const participantIds = JSON.parse(row.participant_ids ?? "[]") as string[];
  const event: PresentedEvent = {
    _id: row.source_id,
    title: row.title,
    hostId: populateHost ? parsePerson(row.host_json) : row.host_id,
    category: row.category,
    type: row.type,
    eventDate: row.event_date,
    participantIds: populateParticipants ? participants.map(presentPerson) : participantIds.filter(Boolean),
    tags: JSON.parse(row.tags),
    status: row.status,
    festival: row.festival,
    featured: Boolean(row.featured),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
  if (row.description != null) event.description = row.description;
  if (row.cover_image != null) event.coverImage = row.cover_image;
  if (row.event_end_date != null) event.eventEndDate = row.event_end_date;
  if (row.timezone != null) event.timezone = row.timezone;
  if (row.room_id != null) event.roomId = row.room_id;
  if (row.max_participants != null) event.maxParticipants = row.max_participants;
  return event;
}

export function createD1EventsRouter(db: D1Database, allowCreate?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  async function readEvent(id: string, populateHost = false, populateParticipants = false) {
    const row = await db.prepare(`${eventSelect} WHERE e.source_id = ?`).bind(id).first<EventRow>();
    return row ? presentEvent(row, populateHost, populateParticipants) : null;
  }

  function listFilter(query: Record<string, unknown>, now: Date) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const text = (key: string) => String(query[key] ?? "") || undefined;
    const status = text("status");
    const type = text("type");
    const category = text("category");
    const festival = text("festival");
    const roomId = text("roomId");
    const featured = query.featured === "true";
    const upcoming = query.upcoming === "true";

    if (status && !upcoming) {
      clauses.push("e.status = ?");
      values.push(status);
    }
    if (type) {
      clauses.push("e.type = ?");
      values.push(type);
    }
    if (category) {
      clauses.push("e.category = ?");
      values.push(category);
    }
    if (festival) {
      clauses.push("e.festival = ?");
      values.push(festival);
    }
    if (featured) clauses.push("e.featured = 1");
    if (roomId && isValidObjectId(roomId)) {
      clauses.push("e.room_id = ?");
      values.push(roomId.toLowerCase());
    }
    if (upcoming) {
      clauses.push("e.event_date >= ?", "e.status IN ('UPCOMING', 'LIVE')");
      values.push(now.toISOString());
    }
    return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", values };
  }

  const requireEventSession = asyncHandler(async (req, res, next) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    res.locals.eventUserId = user.id;
    next();
  });
  const enforceCreateLimit = asyncHandler(async (_req, res, next) => {
    await enforceD1UserRateLimit(allowCreate, res.locals.eventUserId as string, res, 60);
    next();
  });
  const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.eventUserId as string;

  router.post("/events", requireEventSession, enforceCreateLimit, validateBody(createSchema),
    asyncHandler(async (req, res) => {
      const input = req.body as CreateEvent;
      const time = new Date().toISOString();
      const id = newId();
      // The legacy model casts roomId to ObjectId after Zod validation; an invalid
      // value becomes the same CastError-shaped 400 before anything is written.
      if (input.roomId && !isValidObjectId(input.roomId)) {
        throw new HttpError(400, "Invalid identifier", ErrorCode.VALIDATION);
      }
      const roomId = input.roomId ? input.roomId.toLowerCase() : null;
      // Mongoose trims title before persistence, after the legacy Zod length check.
      await db.prepare(`INSERT INTO events (source_id, title, description, host_id, cover_image, category, type,
        event_date, event_end_date, timezone, room_id, max_participants, tags, status, festival, featured, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', ?, ?, ?, ?)`)
        .bind(id, input.title.trim(), input.description ?? null, userIdOf(res), input.coverImage ?? null, input.category,
          input.type, input.eventDate.toISOString(), input.eventEndDate?.toISOString() ?? null, input.timezone ?? null,
          roomId, input.maxParticipants ?? null, JSON.stringify(input.tags ?? []), input.festival ?? "none",
          input.featured ? 1 : 0, time, time).run();
      sendOk(res, { event: await readEvent(id) });
    }));

  router.get("/events", asyncHandler(async (req, res) => {
    const page = Math.max(1, Math.min(10000, Math.trunc(Number(req.query.page)) || 1));
    const limit = Math.max(1, Math.min(Math.trunc(Number(req.query.limit)) || 20, 50));
    const skip = (page - 1) * limit;
    const { where, values } = listFilter(req.query as Record<string, unknown>, new Date());
    const [rows, count] = await Promise.all([
      db.prepare(`${eventSelect}${where} ORDER BY e.featured DESC, e.event_date ASC, e.source_id ASC LIMIT ? OFFSET ?`)
        .bind(...values, limit, skip).all<EventRow>(),
      db.prepare(`SELECT COUNT(*) AS total FROM events AS e${where}`).bind(...values).first<{ total: number }>()
    ]);
    sendOk(res, {
      events: rows.results.map(row => presentEvent(row, true, false)),
      pagination: { page, limit, total: count?.total ?? 0, pages: Math.ceil((count?.total ?? 0) / limit) }
    });
  }));

  router.get("/events/user/me", requireEventSession, asyncHandler(async (req, res) => {
    const userId = userIdOf(res);
    const [hosting, joined] = await Promise.all([
      db.prepare(`${eventSelect} WHERE e.host_id = ? ORDER BY e.event_date DESC, e.source_id DESC LIMIT 50`)
        .bind(userId).all<EventRow>(),
      db.prepare(`${eventSelect} WHERE e.host_id <> ? AND EXISTS (
        SELECT 1 FROM event_participants AS p WHERE p.events_id = e.source_id AND p.value = ?)
        ORDER BY e.event_date DESC, e.source_id DESC LIMIT 50`).bind(userId, userId).all<EventRow>()
    ]);
    sendOk(res, {
      hosting: hosting.results.map(row => presentEvent(row, false, false)),
      joined: joined.results.map(row => presentEvent(row, false, false))
    });
  }));

  router.get("/events/:eventId", asyncHandler(async (req, res) => {
    const event = await readEvent(eventId(req.params.eventId, "Invalid identifier"), true, true);
    if (!event) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
    sendOk(res, { event });
  }));

  router.post("/events/:eventId/join", requireEventSession, asyncHandler(async (req, res) => {
    const id = eventId(req.params.eventId);
    const userId = userIdOf(res);
    const joinId = newId();
    const time = new Date().toISOString();
    const claimed = "EXISTS (SELECT 1 FROM event_participants WHERE events_id = ? AND value = ? AND source_id = ?)";
    let inserted = false;
    try {
      const [claim] = await db.batch([
        db.prepare(`INSERT INTO event_participants (source_id, value, events_id, position)
          SELECT ?, ?, e.source_id,
            (SELECT COUNT(*) FROM event_participants AS p WHERE p.events_id = e.source_id)
          FROM events AS e
          WHERE e.source_id = ? AND e.status = 'UPCOMING'
            AND (e.max_participants IS NULL
              OR (SELECT COUNT(*) FROM event_participants AS p WHERE p.events_id = e.source_id) < e.max_participants)
            AND NOT EXISTS (SELECT 1 FROM event_participants AS p WHERE p.events_id = e.source_id AND p.value = ?)`)
          .bind(joinId, userId, id, userId),
        db.prepare(`UPDATE events SET updated_at = ? WHERE source_id = ? AND ${claimed}`)
          .bind(time, id, id, userId, joinId)
      ]);
      inserted = Boolean(claim.meta.changes);
    } catch (error) {
      // A concurrent insert can lose the unique-key race after the capacity check.
      // Re-read the authoritative row and classify the retry like the legacy handler.
      const existing = await readEvent(id);
      if (!existing) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
      if (existing.status !== "UPCOMING") throw new HttpError(409, "Event is not open for joining", ErrorCode.CONFLICT);
      if ((existing.participantIds as string[]).includes(userId)) {
        sendOk(res, { event: existing, alreadyJoined: true });
        return;
      }
      throw error;
    }

    const current = await readEvent(id);
    if (!inserted) {
      if (!current) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
      if (current.status !== "UPCOMING") throw new HttpError(409, "Event is not open for joining", ErrorCode.CONFLICT);
      if ((current.participantIds as string[]).includes(userId)) {
        sendOk(res, { event: current, alreadyJoined: true });
        return;
      }
      throw new HttpError(409, "Event is full. Try again if a place becomes available.", ErrorCode.CONFLICT);
    }

    if (current) {
      const actor = await db.prepare("SELECT name FROM users WHERE source_id = ?")
        .bind(userId).first<string>("name");
      const notificationTime = new Date().toISOString();
      void db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        VALUES (?, ?, 'SYSTEM', 'New event participant', ?, ?, 0, ?, ?)`)
        .bind(newId(), current.hostId as string, `${actor ?? "Someone"} joined your event "${current.title}"`,
          JSON.stringify({ eventId: current._id }), notificationTime, notificationTime)
        .run().catch(() => console.warn("Event registration notification failed after acceptance"));
    }
    sendOk(res, { event: current, alreadyJoined: false });
  }));

  router.post("/events/:eventId/cancel", requireEventSession, asyncHandler(async (req, res) => {
    const id = eventId(req.params.eventId, "Invalid identifier");
    const result = await db.prepare(`UPDATE events SET status = 'CANCELLED', updated_at = ?
      WHERE source_id = ? AND host_id = ?`).bind(new Date().toISOString(), id, userIdOf(res)).run();
    if (!result.meta.changes) throw new HttpError(404, "Event not found or not your event", ErrorCode.NOT_FOUND);
    sendOk(res, { event: await readEvent(id) });
  }));

  router.post("/events/:eventId/leave", requireEventSession, asyncHandler(async (req, res) => {
    const id = eventId(req.params.eventId);
    const time = new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM event_participants WHERE events_id = ? AND value = ?").bind(id, userIdOf(res)),
      // Mongoose timestamps the update even when $pull removes no element.
      db.prepare("UPDATE events SET updated_at = ? WHERE source_id = ?").bind(time, id)
    ]);
    const event = await readEvent(id);
    if (!event) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
    event.updatedAt = time;
    sendOk(res, { event });
  }));

  return router;
}
