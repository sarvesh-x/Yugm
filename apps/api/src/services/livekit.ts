import { AccessToken } from "livekit-server-sdk";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

export interface MediaTokenRequest {
  identity: string;
  roomName: string;
  canPublish: boolean;
  canSubscribe: boolean;
}

export interface MediaProvider {
  createToken(input: MediaTokenRequest): Promise<{ token: string; url: string }>;
}

export class LiveKitMediaProvider implements MediaProvider {
  async createToken(input: MediaTokenRequest) {
    if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new HttpError(503, "LiveKit credentials are not configured");
    }

    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: input.identity,
      ttl: "2h"
    });

    token.addGrant({
      room: input.roomName,
      roomJoin: true,
      canPublish: input.canPublish,
      canSubscribe: input.canSubscribe
    });

    return { token: await token.toJwt(), url: env.LIVEKIT_URL };
  }
}

export const mediaProvider = new LiveKitMediaProvider();
