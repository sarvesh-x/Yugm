import type { D1Database } from "@cloudflare/workers-types";
import { livekitTokenSchema } from "@yugm/shared";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";

export interface D1LiveKitConfig {
  apiKey?: string;
  apiSecret?: string;
  url?: string;
  production?: boolean;
}

interface ParticipantRow {
  role: string;
  mic_enabled: number;
  moderator_muted: number;
  camera_enabled: number;
}

interface RoomRow {
  type: string;
  status: string;
  livekit_room_name: string;
}

const speakingRoles = new Set(["HOST", "SPEAKER", "MODERATOR"]);
const cameraSource = "camera";
const microphoneSource = "microphone";
const roomMusicSource = "screen_share_audio";
const tokenTtlSeconds = 2 * 60 * 60;

function base64Url(value: string | Uint8Array) {
  let binary: string;
  if (typeof value === "string") {
    binary = value;
  } else {
    binary = Array.from(value, byte => String.fromCharCode(byte)).join("");
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build the same HS256 access token the LiveKit server SDK issues, using host-neutral Web Crypto. */
async function createLiveKitToken(config: Required<Pick<D1LiveKitConfig, "apiKey" | "apiSecret" | "url">>,
  input: { identity: string; roomName: string; publishSources: string[] }
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    video: {
      room: input.roomName,
      roomJoin: true,
      canPublish: input.publishSources.length > 0,
      canPublishSources: input.publishSources,
      canSubscribe: true
    },
    iss: config.apiKey,
    sub: input.identity,
    nbf: issuedAt,
    exp: issuedAt + tokenTtlSeconds
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.apiSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

export function createD1LiveKitRouter(db: D1Database, config: D1LiveKitConfig) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  router.post("/livekit/token", validateBody(livekitTokenSchema), asyncHandler(async (req, res) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const body = req.body as z.infer<typeof livekitTokenSchema>;
    if (!isValidObjectId(body.roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    if (!config.apiKey || !config.apiSecret) {
      throw new HttpError(503, "LiveKit credentials are not configured");
    }
    if (!config.url?.trim() || (config.production && !config.url.startsWith("wss://"))) {
      throw new HttpError(503, "LiveKit URL is not configured for production");
    }
    const id = body.roomId.toLowerCase();
    const room = await db.prepare("SELECT type, status, livekit_room_name FROM rooms WHERE source_id = ?")
      .bind(id).first<RoomRow>();
    if (!room || room.status !== "LIVE") throw new HttpError(404, "Live room not found", ErrorCode.NOT_FOUND);
    const participant = await db.prepare(`SELECT role, mic_enabled, moderator_muted, camera_enabled
      FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
      ORDER BY joined_at, source_id LIMIT 1`).bind(id, claims.sub).first<ParticipantRow>();
    if (!participant) {
      throw new HttpError(403, "Join the room before requesting a media token", ErrorCode.FORBIDDEN);
    }
    const role = participant.role ?? "AUDIENCE";
    const canSpeak = Boolean(participant.mic_enabled) && !participant.moderator_muted && speakingRoles.has(role);
    // Audience members still receive the separate screen-share-audio capability for room music.
    const canPublishRoomMusic = !participant.moderator_muted;
    const canPublishVideo = room.type === "VIDEO" && speakingRoles.has(role) &&
      participant.camera_enabled !== 0 && !participant.moderator_muted;
    const publishSources = [
      ...(canPublishVideo ? [cameraSource] : []),
      ...(canSpeak ? [microphoneSource] : []),
      ...(canPublishRoomMusic ? [roomMusicSource] : [])
    ];
    const token = await createLiveKitToken({ apiKey: config.apiKey, apiSecret: config.apiSecret, url: config.url }, {
      identity: claims.sub, roomName: room.livekit_room_name, publishSources
    });
    sendOk(res, {
      token, url: config.url, identity: claims.sub, roomName: room.livekit_room_name,
      role, canPublishMicrophone: canSpeak
    });
  }));

  return router;
}
