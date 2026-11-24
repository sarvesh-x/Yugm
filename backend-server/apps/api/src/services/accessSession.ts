import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessClaims {
  sub: string;
  sid: string;
  tokenVersion?: number;
}

export interface AccessAccount {
  tokenVersion?: number;
  isBlocked?: boolean;
  moderationReason?: string;
  suspendedUntil?: Date;
}

export interface AccessSession {
  tokenVersion?: number | null;
}

export type ReadAccessContext<Account extends AccessAccount = AccessAccount, Session extends AccessSession = AccessSession> =
  (claims: AccessClaims) => Promise<{ user: Account | null; session: Session | null; invalidate?: () => void }>;

export function verifyAccessToken(token: string): AccessClaims | null {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || decoded.typ !== "access" ||
      typeof decoded.sid !== "string" || !decoded.sid || typeof decoded.sub !== "string" || !decoded.sub ||
      (decoded.tokenVersion !== undefined && typeof decoded.tokenVersion !== "number")) return null;
  return { sub: decoded.sub, sid: decoded.sid, tokenVersion: decoded.tokenVersion };
}

export function matchesAccessGeneration(claims: AccessClaims, user: AccessAccount, session: AccessSession) {
  return (session.tokenVersion ?? claims.tokenVersion) === claims.tokenVersion &&
    (claims.tokenVersion === undefined || user.tokenVersion === claims.tokenVersion);
}
