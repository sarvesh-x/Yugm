import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { noD1Presence, type D1PresencePort } from "./d1Presence.js";
import { person, personJson, visiblePerson } from "./d1People.js";
import { roomAccessFor } from "./d1RoomAccess.js";
import { d1RoomProjection, presentD1Room } from "./d1Rooms.js";

type Row = Record<string, string | number | null> & { host_json?: string; person_json?: string };

const hubs = [
  { type: "interest", name: "Music 🎵", key: "music", count: 0 },
  { type: "interest", name: "Gaming 🎮", key: "gaming", count: 0 },
  { type: "interest", name: "Study 📚", key: "study", count: 0 },
  { type: "interest", name: "Fitness 💪", key: "fitness", count: 0 },
  { type: "interest", name: "Movies 🎬", key: "movies", count: 0 },
  { type: "mood", name: "Chill ☕", key: "chill", count: 0 },
  { type: "mood", name: "Hype 🔥", key: "hype", count: 0 },
  { type: "mood", name: "Late Night 🌙", key: "late_night", count: 0 },
  { type: "language", name: "Hindi 🇮🇳", key: "hindi", count: 0 },
  { type: "language", name: "English 🇬🇧", key: "english", count: 0 },
  { type: "language", name: "Tamil", key: "tamil", count: 0 },
  { type: "language", name: "Telugu", key: "telugu", count: 0 }
];

function paging(req: Request) {
  const requestedPage = Number.parseInt(String(req.query.page ?? "1"), 10);
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "20"), 10);
  // Legacy NaN values became unbounded queries. D1 guards them to the defaults.
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;
  return { page, limit, offset: Math.min((page - 1) * limit, Number.MAX_SAFE_INTEGER) };
}

function strings(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function presentRoom(row: Row) {
  const fullHost = person(String(row.host_json ?? "{}")) as Record<string, unknown>;
  const host = {
    _id: fullHost._id, name: fullHost.name, avatar: fullHost.avatar,
    avatarType: fullHost.avatarType, avatarParts: fullHost.avatarParts,
    username: fullHost.username, activeCosmetics: fullHost.activeCosmetics, level: fullHost.level
  };
  return { ...presentD1Room(row, false), host: Object.keys(host).length ? host : undefined };
}

function presentUser(row: Row, isOnline: boolean) {
  const personJsonValue = person(String(row.person_json ?? "{}")) as Record<string, unknown>;
  return {
    _id: personJsonValue._id,
    name: personJsonValue.name,
    avatar: personJsonValue.avatar,
    avatarType: personJsonValue.avatarType,
    avatarParts: personJsonValue.avatarParts,
    username: personJsonValue.username,
    level: personJsonValue.level,
    levelTitle: personJsonValue.levelTitle,
    city: personJsonValue.city,
    isOnline
  };
}

const visibleLiveRooms = `r.status = 'LIVE' AND (${roomAccessFor("?1")}) AND ${visiblePerson("host", "?1")}`;
const liveRooms = `FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE ${visibleLiveRooms}`;
const discoveryOrder = `ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id DESC`;

export function createD1DiscoverRouter(db: D1Database, presence: D1PresencePort = noD1Presence) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  router.get("/discover/presence-count", asyncHandler(async (req, res) => {
    await requireHttpSession(req.headers.authorization, access);
    sendOk(res, { count: await presence.getPresenceCount() });
  }));

  router.get("/discover/trending", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const { limit, offset, page } = paging(req);
    const rooms = await db.prepare(`SELECT ${d1RoomProjection} ${liveRooms}
      ${discoveryOrder} LIMIT ?2 OFFSET ?3`).bind(user.id, limit, offset).all<Row>();
    sendOk(res, { rooms: rooms.results.map(presentRoom), page, limit });
  }));

  router.get("/discover/recommended", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const actor = await db.prepare(`SELECT
      (SELECT json_group_array(value) FROM (SELECT value FROM user_interests
        WHERE users_id = ?1 ORDER BY position)) AS interests_json,
      (SELECT json_group_array(value) FROM (SELECT value FROM user_languages
        WHERE users_id = ?1 ORDER BY position)) AS languages_json`)
      .bind(user.id).first<{ interests_json: string; languages_json: string }>();
    const interests = strings(actor?.interests_json);
    const languages = strings(actor?.languages_json);

    const [rooms, users, onlineIds] = await Promise.all([
      db.prepare(`SELECT ${d1RoomProjection} ${liveRooms} ${discoveryOrder} LIMIT 10`).bind(user.id).all<Row>(),
      db.prepare(`SELECT u.source_id, ${personJson("u")} AS person_json FROM users AS u
        WHERE u.source_id <> ?1 AND ${visiblePerson("u", "?1")}
          AND ((json_array_length(?2) = 0 AND json_array_length(?3) = 0)
            OR EXISTS (SELECT 1 FROM user_interests WHERE users_id = u.source_id
              AND value IN (SELECT value FROM json_each(?2)))
            OR EXISTS (SELECT 1 FROM user_languages WHERE users_id = u.source_id
              AND value IN (SELECT value FROM json_each(?3)))) LIMIT 10`)
        .bind(user.id, JSON.stringify(interests), JSON.stringify(languages)).all<Row>(),
      presence.getOnlineUserIds()
    ]);
    const online = new Set(onlineIds);
    sendOk(res, {
      rooms: rooms.results.map(row => ({ item: presentRoom(row), reason: "Matches your interests" })),
      users: users.results.map(row => ({
        item: presentUser(row, online.has(String(row.source_id))), reason: "Similar vibe"
      })),
      events: []
    });
  }));

  router.get("/discover/online-now", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const { limit, page, offset } = paging(req);
    const onlineIds = await presence.getOnlineUserIds();
    if (!onlineIds.length) return sendOk(res, { users: [], page, limit });
    const rows = await db.prepare(`SELECT ${personJson("u")} AS person_json FROM users AS u
      WHERE u.source_id <> ?1 AND ${visiblePerson("u", "?1")}
      AND u.source_id IN (SELECT value FROM json_each(?2))
      ORDER BY u.updated_at DESC, u.source_id DESC LIMIT ?3 OFFSET ?4`)
      .bind(user.id, JSON.stringify(onlineIds), limit, offset).all<Row>();
    sendOk(res, { users: rows.results.map(row => {
      const value = person(String(row.person_json ?? "{}")) as Record<string, unknown>;
      return {
        _id: value._id, name: value.name, avatar: value.avatar, avatarType: value.avatarType,
        avatarParts: value.avatarParts, username: value.username, level: value.level,
        levelTitle: value.levelTitle, city: value.city
      };
    }), page, limit });
  }));

  router.get("/discover/hubs", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const live = await db.prepare(`SELECT r.tags, r.language ${liveRooms}`).bind(user.id).all<{
      tags: string | null; language: string | null;
    }>();
    const counted = hubs.map(hub => ({ ...hub, count: live.results.filter(row => hub.type === "language"
      ? row.language?.toLowerCase() === hub.key
      : strings(row.tags).some(tag => tag.toLowerCase() === hub.key)).length }));
    sendOk(res, { hubs: counted });
  }));

  router.get("/discover/hub/:key", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const { limit, offset, page } = paging(req);
    const key = String(req.params.key ?? "").toLowerCase();
    const rooms = await db.prepare(`SELECT ${d1RoomProjection} ${liveRooms}
      AND (EXISTS (SELECT 1 FROM json_each(r.tags) WHERE lower(value) = ?2) OR lower(r.language) = ?2)
      ${discoveryOrder} LIMIT ?3 OFFSET ?4`).bind(user.id, key, limit, offset).all<Row>();
    sendOk(res, { items: rooms.results.map(presentRoom), page, limit });
  }));

  return router;
}
