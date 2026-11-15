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
import { endRoom, recordRoomParticipantExit } from "./roomLifecycle.js";
import { isAlwaysOnOfficialVoiceRoom } from "./officialRooms.js";
import {
  clearRoomSocketDisconnect,
  consumeRedisRateLimit,
  createRedisConnection,
  getOnlinePresenceIds,
  hasRoomSocketDisconnectGrace,
  isUserPresent,
  markRoomSocketDisconnected,
  setUserConnectionPresence
} from "./redis.js";

export let io: Server;

const onlineUsers = new Map<string, { count: number; lastSeen: number }>();
const redisPresenceUsers = new Set<string>();
const messageCounts = new Map<string, { count: number; resetAt: number }>();
const adapterClients: NonNullable<ReturnType<typeof createRedisConnection>>[] = [];
let presenceSnapshotTimer: NodeJS.Timeout | undefined;
let inactiveRoomTimer: NodeJS.Timeout | undefined;
const roomExitTimers = new Map<string, NodeJS.Timeout>();
let isSweepingRooms = false;

const roomExitKey = (roomId: string, userId: string) => `${roomId}:${userId}`;

function cancelRoomExit(roomId: string, userId: string) {
  const key = roomExitKey(roomId, userId);
  const timer = roomExitTimers.get(key);
  if (timer) clearTimeout(timer);
  roomExitTimers.delete(key);
}

function scheduleRoomParticipantExit(roomId: string, userId: string, reason: string) {
  if (!io || !/^[0-9a-fA-F]{24}$/.test(roomId) || !userId) return;
  markRoomSocketDisconnected(roomId, userId).catch(() => {});
  cancelRoomExit(roomId, userId);
  const key = roomExitKey(roomId, userId);
  const timer = setTimeout(async () => {
    roomExitTimers.delete(key);
    try {
      const connected = await io.in(`room:${roomId}`).fetchSockets();
      if (connected.some((candidate) => candidate.data.userId === userId)) return;
      const result = await recordRoomParticipantExit(roomId, userId, reason);
      if (!result.changed) return;
      emitRoom(roomId, socketEvents.roomParticipantUpdate, { roomId, userId, action: "disconnect" });
      if (result.ended) emitRoom(roomId, socketEvents.roomEnded, { roomId, reason: "host disconnected or room became empty" });
    } catch (error) {
      console.warn("Disconnected room participant cleanup failed:", error instanceof Error ? error.message : String(error));
    }
  }, 15_000);
  timer.unref?.();
  roomExitTimers.set(key, timer);
}

async function cleanupRoomsWithoutConnections() {
  if (!io || isSweepingRooms) return;
  isSweepingRooms = true;
  try {
    const [candidateRooms, connectedSockets] = await Promise.all([
      Room.find({
        status: "LIVE",
        createdAt: { $lte: new Date(Date.now() - 3 * 60_000) }
      }).select("_id type livekitRoomName").lean(),
      io.fetchSockets()
    ]);
    const candidateIds = candidateRooms.map((room) => room._id);
    if (candidateIds.length === 0) return;
    const candidateIdSet = new Set(candidateIds.map((id) => id.toString()));
    const participants = await RoomParticipant.find({ roomId: { $in: candidateIds }, leftAt: null })
      .select("roomId userId").lean();
    const activeUsersByRoom = new Map<string, Set<string>>();
    for (const participant of participants) {
      const key = participant.roomId.toString();
      const users = activeUsersByRoom.get(key) ?? new Set<string>();
      users.add(participant.userId.toString());
      activeUsersByRoom.set(key, users);
    }
    const connectedUsersByRoom = new Map<string, Set<string>>();
    for (const candidate of connectedSockets) {
      const connectedUserId = String(candidate.data.userId ?? "");
      if (!connectedUserId) continue;
      for (const roomKey of candidate.rooms) {
        if (!roomKey.startsWith("room:")) continue;
        const key = roomKey.slice("room:".length);
        if (!candidateIdSet.has(key)) continue;
        const users = connectedUsersByRoom.get(key) ?? new Set<string>();
        users.add(connectedUserId);
        connectedUsersByRoom.set(key, users);
      }
    }
    for (const room of candidateRooms) {
      if (isAlwaysOnOfficialVoiceRoom(room)) continue;
      const roomId = room._id.toString();
      if ([...roomExitTimers.keys()].some((key) => key.startsWith(`${roomId}:`))) continue;
      const activeUserIds = activeUsersByRoom.get(roomId);
      const connectedUserIds = connectedUsersByRoom.get(roomId);
      if (activeUserIds && connectedUserIds && [...connectedUserIds].some((userId) => activeUserIds.has(userId))) continue;
      if (activeUserIds && await hasRoomSocketDisconnectGrace(roomId, [...activeUserIds])) continue;
      const ended = await endRoom(roomId, activeUserIds ? "no connected users" : "no active participants");
      if (ended) emitRoom(roomId, socketEvents.roomEnded, { roomId, reason: "room was empty" });
    }
  } catch (error) {
    console.warn("Inactive room cleanup failed:", error instanceof Error ? error.message : String(error));
  } finally {
    isSweepingRooms = false;
  }
}

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
  inactiveRoomTimer = setInterval(() => {
    cleanupRoomsWithoutConnections().catch((err) => console.warn("Inactive room cleanup failed:", err instanceof Error ? err.message : String(err)));
  }, 60_000);
  inactiveRoomTimer.unref?.();

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

    socket.on(socketEvents.roomJoin, async ({ roomId }: { roomId?: string }, acknowledge?: (result: { joined: boolean; reason?: string }) => void) => {
      const socketUserId = socket.data.userId as string | undefined;
      const reject = (reason: string) => acknowledge?.({ joined: false, reason });
      try {
        if (!socketUserId || !/^[0-9a-fA-F]{24}$/.test(String(roomId))) return reject("invalid_request");
        const room = await Room.findById(roomId).select("hostId status visibility").lean();
        if (!room || room.status !== "LIVE") return reject("room_unavailable");
        const blocked = await Block.exists({ blockerId: room.hostId, blockedUserId: socketUserId });
        if (blocked) return reject("access_denied");
        const participant = await RoomParticipant.exists({ roomId, userId: socketUserId, leftAt: null });
        if (!participant) return reject("not_a_participant");
        await socket.join(`room:${roomId}`);
        cancelRoomExit(String(roomId), socketUserId);
        clearRoomSocketDisconnect(String(roomId), socketUserId).catch(() => {});
        acknowledge?.({ joined: true });
      } catch (error) {
        console.warn("Socket room join failed:", error instanceof Error ? error.message : String(error));
        reject("join_failed");
      }
    });

    socket.on(socketEvents.roomLeave, ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      if (userId) scheduleRoomParticipantExit(String(roomId), userId, "room socket left");
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

    socket.on("disconnecting", () => {
      for (const roomKey of socket.rooms) {
        if (roomKey.startsWith("room:")) {
          scheduleRoomParticipantExit(roomKey.slice("room:".length), userId ?? "", "socket disconnected");
        }
      }
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
  if (inactiveRoomTimer) clearInterval(inactiveRoomTimer);
  roomExitTimers.forEach(clearTimeout);
  roomExitTimers.clear();
  await Promise.all(adapterClients.splice(0).map((client) => client.quit().catch(() => client.disconnect())));
}
