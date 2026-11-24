import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";

const startSchema = z.object({
  title: z.string().min(1).max(120),
  mediaUrl: z.string().url()
});

const syncSchema = z.object({
  position: z.number().min(0),
  isPlaying: z.boolean()
});

type WatchPartyRow = {
  source_id: string;
  room_id: string;
  host_id: string;
  title: string;
  media_url: string;
  position: number;
  is_playing: number;
  created_at: string | null;
  updated_at: string | null;
};

function watchParty(row: WatchPartyRow) {
  return {
    _id: row.source_id,
    roomId: row.room_id,
    hostId: row.host_id,
    title: row.title,
    mediaUrl: row.media_url,
    position: row.position,
    isPlaying: Boolean(row.is_playing),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function createD1WatchPartyRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  router.post("/rooms/:roomId/watch-party", validateBody(startSchema), asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const roomId = req.params.roomId;
    if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    const room = await db.prepare("SELECT host_id FROM rooms WHERE source_id = ?")
      .bind(roomId.toLowerCase()).first<{ host_id: string }>();
    if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    if (room.host_id !== user.id) throw new HttpError(403, "Only host can start a watch party", ErrorCode.FORBIDDEN);
    const body = req.body as z.infer<typeof startSchema>;
    const id = newId();
    const time = new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM watch_parties WHERE room_id = ?").bind(roomId.toLowerCase()),
      db.prepare(`INSERT INTO watch_parties
        (source_id, room_id, host_id, title, media_url, position, is_playing, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`)
        .bind(id, roomId.toLowerCase(), user.id, body.title, body.mediaUrl, time, time)
    ]);
    sendOk(res, { watchParty: {
      _id: id, roomId: roomId.toLowerCase(), hostId: user.id, title: body.title, mediaUrl: body.mediaUrl,
      position: 0, isPlaying: true, createdAt: time, updatedAt: time
    } });
  }));

  router.get("/rooms/:roomId/watch-party", asyncHandler(async (req, res) => {
    await requireHttpSession(req.headers.authorization, access);
    const roomId = req.params.roomId;
    if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    const row = await db.prepare("SELECT * FROM watch_parties WHERE room_id = ?")
      .bind(roomId.toLowerCase()).first<WatchPartyRow>();
    if (!row) throw new HttpError(404, "No active watch party", ErrorCode.NOT_FOUND);
    sendOk(res, { watchParty: watchParty(row) });
  }));

  router.patch("/rooms/:roomId/watch-party/sync", validateBody(syncSchema), asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const roomId = req.params.roomId;
    if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    const row = await db.prepare("SELECT * FROM watch_parties WHERE room_id = ?")
      .bind(roomId.toLowerCase()).first<WatchPartyRow>();
    if (!row) throw new HttpError(404, "No active watch party", ErrorCode.NOT_FOUND);
    if (row.host_id !== user.id) throw new HttpError(403, "Only host can sync", ErrorCode.FORBIDDEN);
    const body = req.body as z.infer<typeof syncSchema>;
    const time = new Date().toISOString();
    await db.prepare("UPDATE watch_parties SET position = ?, is_playing = ?, updated_at = ? WHERE source_id = ?")
      .bind(body.position, Number(body.isPlaying), time, row.source_id).run();
    sendOk(res, { watchParty: {
      ...watchParty(row), position: body.position, isPlaying: body.isPlaying, updatedAt: time
    } });
  }));

  router.delete("/rooms/:roomId/watch-party", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const roomId = req.params.roomId;
    if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    const deleted = await db.prepare("DELETE FROM watch_parties WHERE room_id = ? AND host_id = ?")
      .bind(roomId.toLowerCase(), user.id).run();
    if (!deleted.meta.changes) throw new HttpError(404, "No active watch party", ErrorCode.NOT_FOUND);
    sendOk(res, { deleted: true });
  }));

  return router;
}
