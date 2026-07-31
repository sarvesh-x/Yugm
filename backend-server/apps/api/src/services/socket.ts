import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { socketEvents } from "@yugm/shared";
import { env } from "../config/env.js";
import { Block } from "../models/Block.js";
import { Clan } from "../models/Clan.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { consumeRedisRateLimit, createRedisConnection, getOnlinePresenceIds, isUserPresent, setUserConnectionPresence } from "./redis.js";

export let io: Server;

const onlineUsers = new Map<string, { count: number; lastSeen: number }>();
const redisPresenceUsers = new Set<string>();
const messageCounts = new Map<string, { count: number; resetAt: number }>();
const adapterClients: NonNullable<ReturnType<typeof createRedisConnection>>[] = [];
let presenceSnapshotTimer: NodeJS.Timeout | undefined;

function cleanupStaleConnections() {
  const now = Date.now();
  for (const [userId, state] of onlineUsers) {
    if (now - state.lastSeen > 300_000) {
      onlineUsers.delete(userId);
    }
  }
}
setInterval(cleanupStaleConnections, 60_000).unref();

async function refreshRedisPresenceSnapshot() {
  const ids = await getOnlinePresenceIds();
  redisPresenceUsers.clear();
  ids.forEach((id) => redisPresenceUsers.add(id));
}

async function configureRedisAdapter(server: Server) {
  const pubClient = createRedisConnection({ maxRetriesPerRequest: null });
  const subClient = pubClient?.duplicate();
  if (!pubClient || !subClient) {
    console.log("Socket.IO Redis adapter disabled: REDIS_URL is empty");
    return;
  }
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    server.adapter(createAdapter(pubClient, subClient));
    adapterClients.push(pubClient, subClient);
    console.log("Socket.IO Redis adapter enabled");
  } catch (error) {
    console.warn("Socket.IO Redis adapter unavailable; using single-node adapter:", error instanceof Error ? error.message : String(error));
    pubClient.disconnect();
    subClient.disconnect();
  }
}

export async function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",") }
  });
  await configureRedisAdapter(io);
  await refreshRedisPresenceSnapshot();
  presenceSnapshotTimer = setInterval(() => {
    refreshRedisPresenceSnapshot().catch((err) => console.warn("Presence snapshot refresh failed:", err instanceof Error ? err.message : String(err)));
  }, 15_000);
  presenceSnapshotTimer.unref?.();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as { sub: string };
      socket.data.userId = decoded.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      const state = onlineUsers.get(userId);
      onlineUsers.set(userId, { count: (state?.count ?? 0) + 1, lastSeen: Date.now() });
      socket.join(`user:${userId}`);
      redisPresenceUsers.add(userId);
      setUserConnectionPresence(userId, socket.id, true).catch((err) => console.error("Presence error:", err));
      const presenceRefresh = setInterval(() => {
        const current = onlineUsers.get(userId);
        if (current) current.lastSeen = Date.now();
        setUserConnectionPresence(userId, socket.id, true).catch((err) => console.error("Presence refresh error:", err));
      }, 120_000);
      presenceRefresh.unref?.();
      socket.data.presenceRefresh = presenceRefresh;
      socket.broadcast.emit(socketEvents.userOnline, { userId });
    }

    socket.on(socketEvents.roomJoin, async ({ roomId }) => {
      const socketUserId = socket.data.userId as string | undefined;
      if (!socketUserId || !/^[0-9a-fA-F]{24}$/.test(String(roomId))) return;
      const room = await Room.findById(roomId).select("hostId status visibility").lean();
      if (!room || room.status !== "LIVE") return;
      const blocked = await Block.exists({ blockerId: room.hostId, blockedUserId: socketUserId });
      if (blocked) return;
      const participant = await RoomParticipant.exists({ roomId, userId: socketUserId, leftAt: null });
      if (!participant) return;
      socket.join(`room:${roomId}`);
    });

    socket.on(socketEvents.roomLeave, ({ roomId }) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on(socketEvents.directTypingStart, ({ userId: targetUserId }) => {
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(String(targetUserId))) return;
      emitUser(String(targetUserId), socketEvents.directTypingUpdate, { userId, typing: true });
    });

    socket.on(socketEvents.directTypingStop, ({ userId: targetUserId }) => {
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(String(targetUserId))) return;
      emitUser(String(targetUserId), socketEvents.directTypingUpdate, { userId, typing: false });
    });

    socket.on(socketEvents.clanTypingStart, async ({ clanId }) => {
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(String(clanId))) return;
      const clan = await Clan.findOne({ _id: clanId, memberIds: userId }).select("memberIds").lean();
      if (!clan) return;
      (clan.memberIds ?? []).forEach((memberId: any) => {
        const target = memberId.toString();
        if (target !== userId) emitUser(target, socketEvents.clanTypingUpdate, { clanId, userId, typing: true });
      });
    });

    socket.on(socketEvents.clanTypingStop, async ({ clanId }) => {
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(String(clanId))) return;
      const clan = await Clan.findOne({ _id: clanId, memberIds: userId }).select("memberIds").lean();
      if (!clan) return;
      (clan.memberIds ?? []).forEach((memberId: any) => {
        const target = memberId.toString();
        if (target !== userId) emitUser(target, socketEvents.clanTypingUpdate, { clanId, userId, typing: false });
      });
    });

    socket.on("disconnect", async () => {
      if (userId) {
        const state = onlineUsers.get(userId);
        if (!state || state.count <= 1) onlineUsers.delete(userId);
        else onlineUsers.set(userId, { count: state.count - 1, lastSeen: Date.now() });
        const presenceRefresh = socket.data.presenceRefresh as NodeJS.Timeout | undefined;
        if (presenceRefresh) clearInterval(presenceRefresh);
        await setUserConnectionPresence(userId, socket.id, false).catch((err) => console.error("Presence error:", err));
        const stillPresent = onlineUsers.has(userId) || await isUserPresent(userId);
        if (!stillPresent) {
          redisPresenceUsers.delete(userId);
          socket.broadcast.emit(socketEvents.userOffline, { userId });
        }
        refreshRedisPresenceSnapshot().catch(() => {});
      }
    });

    // Shared rate limiter when Redis is ready, with a local fallback for development.
    const rateKey = socket.id;
    socket.use(async ([_event], next) => {
      const now = Date.now();
      const redisLimit = await consumeRedisRateLimit(`socket:${userId ?? rateKey}`, 10, 1);
      if (redisLimit) {
        if (!redisLimit.allowed) return;
        next();
        return;
      }

      let entry = messageCounts.get(rateKey);
      if (!entry || entry.resetAt < now) entry = { count: 0, resetAt: now + 1000 };
      entry.count++;
      messageCounts.set(rateKey, entry);
      if (entry.count > 10) {
        return;
      }
      next();
    });
  });

  return io;
}

export function emitRoom(roomId: string, event: string, payload: unknown) {
  io?.to(`room:${roomId}`).emit(event, payload);
}

export function emitUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getPresenceCount() {
  return new Set([...onlineUsers.keys(), ...redisPresenceUsers]).size;
}

export function isUserOnline(userId: string) {
  return onlineUsers.has(userId) || redisPresenceUsers.has(userId);
}

export async function closeSocketInfrastructure() {
  if (presenceSnapshotTimer) clearInterval(presenceSnapshotTimer);
  await Promise.all(adapterClients.splice(0).map((client) => client.quit().catch(() => client.disconnect())));
}
