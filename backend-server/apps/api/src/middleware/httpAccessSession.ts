import type { Request, RequestHandler, Response } from "express";
import { matchesAccessGeneration, verifyAccessToken, type AccessAccount, type AccessSession, type ReadAccessContext } from "../services/accessSession.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export async function requireHttpSession<Account extends AccessAccount, Session extends AccessSession>(
  header: string | null | undefined, readContext: ReadAccessContext<Account, Session>
) {
  try {
    if (!header?.startsWith("Bearer ") || !header.slice(7)) {
      throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);
    }
    const claims = verifyAccessToken(header.slice(7));
    if (!claims) throw new HttpError(401, "Invalid access token", ErrorCode.UNAUTHORIZED);

    const { user, session, invalidate } = await readContext(claims);
    if (!user || user.isBlocked) throw new HttpError(401, user?.moderationReason || "Invalid user", ErrorCode.UNAUTHORIZED);
    if (!session) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    if ((session.tokenVersion ?? claims.tokenVersion) !== claims.tokenVersion) {
      invalidate?.();
      throw new HttpError(401, "This account was signed in on another device", ErrorCode.UNAUTHORIZED);
    }
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      throw new HttpError(403, `Account suspended until ${user.suspendedUntil.toISOString()}`, ErrorCode.FORBIDDEN);
    }
    if (!matchesAccessGeneration(claims, user, session)) {
      invalidate?.();
      throw new HttpError(401, "Token revoked", ErrorCode.UNAUTHORIZED);
    }
    return { user, session, claims };
  } catch (error) {
    throw error instanceof HttpError ? error : new HttpError(401, "Invalid auth token", ErrorCode.UNAUTHORIZED);
  }
}

export function createHttpSessionAuth<Account extends AccessAccount, Session extends AccessSession>(
  readContext: ReadAccessContext<Account, Session>,
  accept: (req: Request, res: Response, user: Account, session: Session) => void
) {
  const required: RequestHandler = async (req, res, next) => {
    try {
      const { user, session } = await requireHttpSession(req.headers.authorization, readContext);
      accept(req, res, user, session);
      next();
    } catch (error) {
      next(error instanceof HttpError ? error : new HttpError(401, "Invalid auth token", ErrorCode.UNAUTHORIZED));
    }
  };

  const optional: RequestHandler = async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const claims = verifyAccessToken(header.slice(7));
        if (claims) {
          const { user, session } = await readContext(claims);
          if (user && !user.isBlocked && session &&
              !(user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) &&
              matchesAccessGeneration(claims, user, session)) {
            accept(req, res, user, session);
          }
        }
      }
    } catch {
      // Optional routes retain their anonymous response on invalid access.
    }
    next();
  };

  return { required, optional };
}
