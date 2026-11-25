import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";

const startSchema = z.object({
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  title: z.string().min(1).max(100).optional()
});

const stopSchema = z.object({
  recordingUrl: z.string().url(),
  duration: z.number().int().min(1)
});

const updateSchema = z.object({
  title: z.string().min(1).max(100).optional()
});

type RecordingRow = {
  source_id: string;
  room_id: string;
  host_id: string;
  title: string;
  recording_url: string;
  duration: number;
  view_count: number;
  status: "PROCESSING" | "PUBLISHED" | "FAILED";
  created_at: string | null;
  updated_at: string | null;
};

function recording(row: RecordingRow) {
  return {
    _id: row.source_id,
    roomId: row.room_id,
    hostId: row.host_id,
    title: row.title,
    recordingUrl: row.recording_url,
    duration: row.duration,
    viewCount: row.view_count,
    status: row.status,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function createD1RecordingsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: import("express").Request) => requireHttpSession(req.headers.authorization, access);

  router.post("/", asyncHandler(async (req, res, next) => {
    res.locals.recordingSession = await authenticate(req);
    next();
  }), validateBody(startSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.recordingSession as Awaited<ReturnType<typeof authenticate>>;
    const body = req.body as z.infer<typeof startSchema>;
    const roomId = body.roomId.toLowerCase();
    const room = await db.prepare("SELECT source_id, host_id, status, title FROM rooms WHERE source_id = ?")
      .bind(roomId).first<{ source_id: string; host_id: string; status: string; title: string }>();
    if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    if (room.host_id !== user.id) throw new HttpError(403, "Only the host can do this", ErrorCode.FORBIDDEN);
    if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);

    const id = newId();
    const time = new Date().toISOString();
    const title = body.title ?? `${room.title} Recording`;
    await db.prepare(`INSERT INTO room_recordings
      (source_id, room_id, host_id, title, recording_url, duration, view_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, 'PROCESSING', ?, ?)`)
      .bind(id, roomId, user.id, title, "", time, time).run();

    sendOk(res, {
      _id: id, roomId, hostId: user.id, title, recordingUrl: "", duration: 0, viewCount: 0,
      status: "PROCESSING", createdAt: time, updatedAt: time
    }, 201);
  }));

  router.get("/room/:roomId", asyncHandler(async (req, res) => {
    await authenticate(req);
    const roomId = req.params.roomId;
    if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const { results } = await db.prepare(
      "SELECT * FROM room_recordings WHERE room_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50"
    ).bind(roomId.toLowerCase()).all<RecordingRow>();
    sendOk(res, results.map(recording));
  }));

  router.get("/:id", asyncHandler(async (req, res) => {
    await authenticate(req);
    const id = req.params.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const row = await db.prepare("SELECT * FROM room_recordings WHERE source_id = ?")
      .bind(id.toLowerCase()).first<RecordingRow>();
    if (!row) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);
    sendOk(res, recording(row));
  }));

  router.post("/:id/view", asyncHandler(async (req, res) => {
    await authenticate(req);
    const id = req.params.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const row = await db.prepare(
      "UPDATE room_recordings SET view_count = view_count + 1, updated_at = ? WHERE source_id = ? RETURNING view_count"
    ).bind(new Date().toISOString(), id.toLowerCase()).first<{ view_count: number }>();
    if (!row) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);
    // Legacy findByIdAndUpdate returns the pre-increment document by default.
    sendOk(res, { viewCount: row.view_count - 1 });
  }));

  router.patch("/:id/stop", asyncHandler(async (req, res, next) => {
    res.locals.recordingSession = await authenticate(req);
    next();
  }), validateBody(stopSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.recordingSession as Awaited<ReturnType<typeof authenticate>>;
    const id = req.params.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const row = await db.prepare("SELECT * FROM room_recordings WHERE source_id = ?")
      .bind(id.toLowerCase()).first<RecordingRow>();
    if (!row) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);
    if (row.host_id !== user.id) throw new HttpError(403, "Only the host can do this", ErrorCode.FORBIDDEN);
    const body = req.body as z.infer<typeof stopSchema>;
    const time = new Date().toISOString();
    await db.prepare(
      "UPDATE room_recordings SET recording_url = ?, duration = ?, status = 'PUBLISHED', updated_at = ? WHERE source_id = ?"
    ).bind(body.recordingUrl, body.duration, time, row.source_id).run();
    sendOk(res, { ...recording(row), recordingUrl: body.recordingUrl, duration: body.duration, status: "PUBLISHED", updatedAt: time });
  }));

  router.patch("/:id", asyncHandler(async (req, res, next) => {
    res.locals.recordingSession = await authenticate(req);
    next();
  }), validateBody(updateSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.recordingSession as Awaited<ReturnType<typeof authenticate>>;
    const id = req.params.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const row = await db.prepare("SELECT * FROM room_recordings WHERE source_id = ?")
      .bind(id.toLowerCase()).first<RecordingRow>();
    if (!row) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);
    if (row.host_id !== user.id) throw new HttpError(403, "Only the host can do this", ErrorCode.FORBIDDEN);
    const body = req.body as z.infer<typeof updateSchema>;
    const time = new Date().toISOString();
    const title = body.title ?? row.title;
    await db.prepare("UPDATE room_recordings SET title = ?, updated_at = ? WHERE source_id = ?")
      .bind(title, time, row.source_id).run();
    sendOk(res, { ...recording(row), title, updatedAt: time });
  }));

  router.delete("/:id", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = req.params.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const row = await db.prepare("SELECT host_id FROM room_recordings WHERE source_id = ?")
      .bind(id.toLowerCase()).first<{ host_id: string }>();
    if (!row) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);
    if (row.host_id !== user.id) throw new HttpError(403, "Only the host can do this", ErrorCode.FORBIDDEN);
    await db.prepare("DELETE FROM room_recordings WHERE source_id = ?").bind(id.toLowerCase()).run();
    sendOk(res, { message: "Recording deleted" });
  }));

  return router;
}
