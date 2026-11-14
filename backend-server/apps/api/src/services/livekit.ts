import { AccessToken, TrackSource } from "livekit-server-sdk";
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

export class LiveKitMediaProvider implements MediaProvider {
  async createToken(input: MediaTokenRequest) {
    if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new HttpError(503, "LiveKit credentials are not configured");
    }
    if (!env.LIVEKIT_URL.trim() || (env.NODE_ENV === "production" && !env.LIVEKIT_URL.startsWith("wss://"))) {
      throw new HttpError(503, "LiveKit URL is not configured for production");
    }

    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
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

    return { token: await token.toJwt(), url: env.LIVEKIT_URL };
  }
}

export const mediaProvider = new LiveKitMediaProvider();
