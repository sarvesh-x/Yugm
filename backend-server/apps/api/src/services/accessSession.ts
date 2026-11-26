import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

import type { AccessClaims } from "./accessGeneration.js";
export { matchesAccessGeneration } from "./accessGeneration.js";
export type { AccessAccount, AccessClaims, AccessSession, ReadAccessContext } from "./accessGeneration.js";

export function verifyAccessToken(token: string): AccessClaims | null {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || decoded.typ !== "access" ||
      typeof decoded.sid !== "string" || !decoded.sid || typeof decoded.sub !== "string" || !decoded.sub ||
      (decoded.tokenVersion !== undefined && typeof decoded.tokenVersion !== "number")) return null;
  return { sub: decoded.sub, sid: decoded.sid, tokenVersion: decoded.tokenVersion,
    ...(typeof decoded.exp === "number" ? { expiresAt: decoded.exp * 1000 } : {}) };
}
