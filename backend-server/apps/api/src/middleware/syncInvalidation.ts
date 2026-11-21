import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth.js";
import { emitUser, invalidatePublicTopics } from "../services/socket.js";

export function mutationTopics(method: string, originalPath: string): string[] {
  const path = originalPath.split("?")[0].replace(/^\/api\//, "/");
  const isAvatarUpload = path === "/upload/avatar";
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method) || /^\/(auth|livekit|admin|payments)\b/.test(path) ||
      (/^\/upload\b/.test(path) && !isAvatarUpload) ||
      /\/(typing|device-token|heartbeat)(\/|$)/.test(path) || (!path.startsWith("/notifications") && /\/(read|read-all)$/.test(path))) return [];
  let topic = isAvatarUpload ? "PROFILE" : "SOCIAL";
  if (path.startsWith("/users/messages")) topic = "CHAT";
  else if (/^\/(rooms|pk|watch-party)\b/.test(path)) topic = "ROOMS";
  else if (/^\/(users|profile|cosmetics|highlights|vibe)\b/.test(path)) topic = "PROFILE";
  else if (/^\/(clans|groups)\b/.test(path)) topic = "CLANS";
  else if (/^\/(wallet|diamonds|subscriptions|creator|withdrawals|payouts)\b/.test(path)) topic = "WALLET";
  else if (/^\/(gifts|inventory|mystery-box)\b/.test(path)) topic = "GIFTS";
  else if (/^\/(missions|battle-pass|achievements|experience|referrals)\b/.test(path)) topic = "TASKS";
  else if (path.startsWith("/events")) topic = "EVENTS";
  else if (path.startsWith("/notifications")) topic = "NOTIFICATIONS";
  else if (/^\/(support|settings|moderation|safety|trust-verification)\b/.test(path)) topic = "SETTINGS";
  return [...new Set([topic, "PROFILE", "TASKS", ...(topic === "GIFTS" ? ["WALLET"] : [])])];
}

/** Only successful committed HTTP responses invalidate; no payload or identifiers broadcast. */
export function createSyncInvalidation(emit = emitUser, broadcast = invalidatePublicTopics) {
  return function syncInvalidation(req: AuthRequest, res: Response, next: NextFunction) {
    const topics = mutationTopics(req.method, req.originalUrl);
    if (topics.length) res.once("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?.id) return;
      emit(req.user.id, "sync:invalidate", { topics });
      const path = req.originalUrl.split("?")[0];
      if (/^\/api\/rooms(?:\/[^/]+)?(?:\/(?:join|leave|end))?$/.test(path)) broadcast("ROOMS");
      if (/^\/api\/experience\/badges\/showcase(?:\/|$)/.test(path)) broadcast("PROFILE");
      if (/^\/api\/events(?:\/|$)/.test(path)) broadcast("EVENTS");
      if (/^\/api\/(feed|stories|voice-polls|countdowns)(?:\/|$)/.test(path)) broadcast("SOCIAL");
      const profileTarget = path.match(/^\/api\/users\/([a-f0-9]{24})\/(?:follow|unfollow)$/i)?.[1];
      if (profileTarget && profileTarget !== req.user.id) emit(profileTarget, "sync:invalidate", { topics: ["PROFILE", "SOCIAL"] });
    });
    next();
  };
}
export const syncInvalidation = createSyncInvalidation();
