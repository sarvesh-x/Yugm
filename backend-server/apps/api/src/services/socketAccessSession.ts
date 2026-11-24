import type { Socket } from "socket.io";
import { matchesAccessGeneration, verifyAccessToken, type AccessClaims, type ReadAccessContext } from "./accessSession.js";

export function createSocketSessionAuth(readContext: ReadAccessContext, recheckPackets = false) {
  async function isCurrent(claims: AccessClaims) {
    const { user, session } = await readContext(claims);
    return Boolean(user && !user.isBlocked && session && matchesAccessGeneration(claims, user, session));
  }

  return async (socket: Socket, next: (error?: Error) => void) => {
    const token: unknown = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    if (typeof token !== "string") return next(new Error("Invalid token"));
    try {
      const claims = verifyAccessToken(token);
      if (!claims) return next(new Error("Invalid token"));
      if (!await isCurrent(claims)) return next(new Error("This account was signed in on another device"));
      socket.data.userId = claims.sub;
      socket.data.sessionId = claims.sid;

      if (recheckPackets) {
        socket.use(async (_packet, accept) => {
          try {
            const current = verifyAccessToken(token);
            if (current && await isCurrent(current)) return accept();
          } catch {
            // Fail closed if the token or the current session cannot be checked.
          }
          socket.disconnect(true);
        });
      }
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  };
}
