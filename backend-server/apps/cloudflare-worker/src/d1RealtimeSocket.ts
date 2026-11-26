import type { D1Database } from "@cloudflare/workers-types";
import { createD1AccessSessionReader } from "../../api/src/migration/d1AccessSession.js";
import { HttpError } from "../../api/src/utils/http.js";
import { canReceiveRealtime } from "./d1RealtimeAccess.js";
import type { NativeRealtimeBindingEnv } from "./nativeRealtimePort.js";

export async function connectD1Realtime(request: Request, env: NativeRealtimeBindingEnv & { AUTH_DB: D1Database }) {
  if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }
  const binding = env.NATIVE_REALTIME;
  if (!binding) return new Response("Realtime unavailable", { status: 503 });
  try {
    const { requireHttpSession } = await import("../../api/src/middleware/httpAccessSession.js");
    const { user, claims } = await requireHttpSession(request.headers.get("Authorization"),
      createD1AccessSessionReader(env.AUTH_DB, "socket"));
    const roomId = new URL(request.url).searchParams.get("roomId")?.toLowerCase() ?? null;
    if (roomId !== null && !/^[a-f0-9]{24}$/i.test(roomId)) return new Response("Invalid room ID", { status: 400 });
    const scope = roomId ? `room:${roomId}` : `user:${user.id}`;
    if (roomId && !await canReceiveRealtime(env.AUTH_DB, claims, scope)) {
      return new Response("Join the room first", { status: 403 });
    }
    return await binding.get(binding.idFromName(scope)).fetch(new Request(
      `https://native-realtime/connect?scope=${encodeURIComponent(scope)}`,
      { headers: { Upgrade: "websocket", "X-Realtime-Session": JSON.stringify(claims) } }
    ));
  } catch (error) {
    if (error instanceof HttpError) return new Response(error.message, { status: error.status });
    throw error;
  }
}
