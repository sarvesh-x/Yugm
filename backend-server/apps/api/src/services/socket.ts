import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { socketEvents } from "@yugm/shared";
import { env } from "../config/env.js";
import { Block } from "../models/Block.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { setUserPresence } from "./redis.js";

export let io: Server;

const onlineUsers = new Map<string, number>();
const messageCounts = new Map<string, { count: number; resetAt: number }>();

function cleanupStaleConnections() {
  const now = Date.now();
  for (const [userId, ts] of onlineUsers) {
    if (now - ts > 300_000) {
      onlineUsers.delete(userId);
    }
  }
}
setInterval(cleanupStaleConnections, 60_000);

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",") }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      socket.data.userId = decoded.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      onlineUsers.set(userId, Date.now());
      socket.join(`user:${userId}`);
      setUserPresence(userId, true).catch((err) => console.error("Presence error:", err));
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

    socket.on("disconnect", () => {
      if (userId) {
        onlineUsers.delete(userId);
        setUserPresence(userId, false).catch((err) => console.error("Presence error:", err));
        socket.broadcast.emit(socketEvents.userOffline, { userId });
      }
    });

    // In-memory rate limiter: max 10 events per second per socket
    const rateKey = socket.id;
    socket.use(([event], next) => {
      const now = Date.now();
      let entry = messageCounts.get(rateKey);
      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + 1000 };
        messageCounts.set(rateKey, entry);
      }
      entry.count++;
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
  return onlineUsers.size;
}

export function isUserOnline(userId: string) {
  return onlineUsers.has(userId);
}
