import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

export interface MediaTokenRequest {
  identity: string;
  roomName: string;
  canPublish: boolean;
  canSubscribe: boolean;
  publishSources?: TrackSource[];
}

export interface MediaProvider {
  createToken(input: MediaTokenRequest): Promise<{ token: string; url: string }>;
}

interface LiveKitConfig {
  apiKey?: string;
  apiSecret?: string;
  url: string;
}

let configuration: LiveKitConfig = {
  apiKey: env.LIVEKIT_API_KEY,
  apiSecret: env.LIVEKIT_API_SECRET,
  url: env.LIVEKIT_URL
};

export function configureLiveKit(config: LiveKitConfig) {
  configuration = config;
  if (!config.apiKey || !config.apiSecret || !config.url.startsWith("wss://")) {
    console.warn("LiveKit is not fully configured; voice/video room tokens will be unavailable.");
  }
}

export class LiveKitMediaProvider implements MediaProvider {
  async createToken(input: MediaTokenRequest) {
    const { apiKey, apiSecret, url } = configuration;
    if (!apiKey || !apiSecret) {
      throw new HttpError(503, "LiveKit credentials are not configured");
    }
    if (!url.trim() || (env.NODE_ENV === "production" && !url.startsWith("wss://"))) {
      throw new HttpError(503, "LiveKit URL is not configured for production");
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: input.identity,
      ttl: "2h"
    });

    token.addGrant({
      room: input.roomName,
      roomJoin: true,
      canPublish: input.canPublish,
      canPublishSources: input.publishSources ?? (input.canPublish ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : []),
      canSubscribe: input.canSubscribe
    });

    return { token: await token.toJwt(), url };
  }
}

export const mediaProvider = new LiveKitMediaProvider();

export async function terminateLiveKitRoom(roomName: string) {
  const { apiKey, apiSecret, url } = configuration;
  if (!roomName || !apiKey || !apiSecret || !url.trim()) return;
  const host = url.trim().replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
  try {
    await new RoomServiceClient(host, apiKey, apiSecret).deleteRoom(roomName);
  } catch (error) {
    // LiveKit may already have removed an empty room; room state in Mongo remains authoritative.
    console.warn("LiveKit room termination failed:", error instanceof Error ? error.message : String(error));
  }
}
