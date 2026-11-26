import { validatedD1LiveKitConfig, type D1LiveKitConfig } from "./d1LiveKit.js";

/**
 * Host-neutral LiveKit RoomService calls (Twirp JSON) for runtimes without `livekit-server-sdk`.
 *
 * LiveKit grants in participant tokens are baked at issuance and cannot be revoked; these calls apply
 * authoritative state to a *currently connected* participant and remove them, so a muted/removed user
 * cannot keep publishing. They are best-effort: media teardown never blocks or fails the room mutation.
 *
 * Requires verification against a live LiveKit server; see docs/handoffs for the parity checklist.
 */

function base64Url(value: string | Uint8Array) {
  let binary: string;
  if (typeof value === "string") binary = value;
  else binary = Array.from(value, byte => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function httpHost(url: string) {
  return url.trim().replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://").replace(/\/+$/, "");
}

/** Server API token: `roomAdmin`, not a participant `roomJoin` token. */
async function createAdminToken(apiKey: string, apiSecret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: apiKey,
    sub: "",
    nbf: issuedAt,
    exp: issuedAt + 60,
    video: { roomAdmin: true, roomList: true, roomCreate: true }
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

async function roomService(config: Required<Pick<D1LiveKitConfig, "apiKey" | "apiSecret" | "url">>, method: string, body: unknown) {
  try {
    const token = await createAdminToken(config.apiKey, config.apiSecret);
    const response = await fetch(`${httpHost(config.url)}/twirp/livekit.RoomService/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!response.ok) console.warn(`LiveKit ${method} failed (${response.status})`, await response.text().catch(() => ""));
  } catch (error) {
    console.warn(`LiveKit ${method} failed`, error instanceof Error ? error.message : String(error));
  }
}

/** Skip silently when media is not configured; teardown must never mask the room result. */
function configured(config: D1LiveKitConfig): Required<Pick<D1LiveKitConfig, "apiKey" | "apiSecret" | "url">> | null {
  try { return validatedD1LiveKitConfig(config); } catch { return null; }
}

/** Delete a room and disconnect everyone in it. LiveKit also removes empty rooms itself. */
export async function deleteLiveKitRoom(config: D1LiveKitConfig, roomName: string) {
  if (!roomName) return;
  const c = configured(config);
  if (!c) return;
  await roomService(c, "DeleteRoom", { room: roomName });
}

/** Remove one participant from the media room immediately (kick). */
export async function removeLiveKitParticipant(config: D1LiveKitConfig, roomName: string, identity: string) {
  if (!roomName || !identity) return;
  const c = configured(config);
  if (!c) return;
  await roomService(c, "RemoveParticipant", { room: roomName, identity });
}

/**
 * Override a connected participant's publish permission server-side.
 * Revoking `can_publish` blocks new publishing; granting restores it. Best-effort; pair with short token TTL.
 */
export async function setLiveKitCanPublish(config: D1LiveKitConfig, roomName: string, identity: string, canPublish: boolean) {
  if (!roomName || !identity) return;
  const c = configured(config);
  if (!c) return;
  await roomService(c, "UpdateParticipant", { room: roomName, identity, permission: { can_publish: canPublish } });
}

/** Disconnect a participant for a forced silence without removing them from the room. */
export async function removeLiveKitParticipantTracks(config: D1LiveKitConfig, roomName: string, identity: string) {
  await setLiveKitCanPublish(config, roomName, identity, false);
}
