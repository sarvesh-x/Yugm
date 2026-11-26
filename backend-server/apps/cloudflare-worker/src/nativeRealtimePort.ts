import { noD1Presence, type D1PresencePort } from "../../api/src/migration/d1Presence.js";
import { noD1Realtime, type D1RealtimePort, type D1RealtimePublish } from "../../api/src/migration/d1Realtime.js";

export interface NativeRealtimeStub {
  fetch(request: Request): Promise<Response>;
}

export interface NativeRealtimeBindingEnv {
  NATIVE_REALTIME?: {
    idFromName(name: string): string;
    get(id: string): NativeRealtimeStub;
  };
}

const PRESENCE_OBJECT = "presence";

async function nativeCall<T>(env: NativeRealtimeBindingEnv, name: string, path: string,
  options: { method?: string; body?: unknown } = {}): Promise<T | undefined> {
  const binding = env.NATIVE_REALTIME;
  if (!binding) return undefined;
  const response = await binding.get(binding.idFromName(name)).fetch(new Request(`https://native-realtime${path}`, {
    method: options.method ?? "GET",
    ...(options.body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.body)
    })
  }));
  if (!response.ok) throw new Error(`Native realtime ${path} failed with ${response.status}`);
  if (response.status === 204) return undefined;
  return await response.json() as T;
}

/**
 * Internal publisher and presence adapter. The Worker exposes only a scoped
 * authenticated upgrade, and presence remains ephemeral.
 */
export function createNativeRealtimePort(env: NativeRealtimeBindingEnv): D1PresencePort & D1RealtimePort {
  if (!env.NATIVE_REALTIME) return { ...noD1Presence, ...noD1Realtime };
  return {
    getPresenceCount: async () => (await nativeCall<{ count: number }>(env, PRESENCE_OBJECT, "/presence/count"))?.count ?? 0,
    isUserOnline: async (userId) => (await nativeCall<{ online: boolean }>(env, PRESENCE_OBJECT,
      `/presence/is-online?userId=${encodeURIComponent(userId)}`))?.online ?? false,
    getOnlineUserIds: async () => (await nativeCall<{ userIds: string[] }>(env, PRESENCE_OBJECT, "/presence/online"))?.userIds ?? [],
    markOnline: async (userId) => {
      await nativeCall(env, PRESENCE_OBJECT, "/presence/online", { method: "POST", body: { userId } });
    },
    markOffline: async (userId) => {
      await nativeCall(env, PRESENCE_OBJECT, "/presence/offline", { method: "POST", body: { userId } });
    },
    emitUser: async (userId, event, payload) => {
      await nativeCall(env, PRESENCE_OBJECT, "/presence/emit-user", {
        method: "POST", body: { userId, event, payload }
      });
    },
    disconnectUser: async (userId) => {
      await nativeCall(env, PRESENCE_OBJECT, "/presence/offline", { method: "POST", body: { userId } });
    },
    publish: async (input: D1RealtimePublish) => {
      await nativeCall(env, input.scope, "/publish", { method: "POST", body: input });
    }
  };
}
