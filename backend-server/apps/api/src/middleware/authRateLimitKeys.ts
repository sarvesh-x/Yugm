import { createHash } from "node:crypto";

export function authIdentifierKey(body: unknown, ip: string) {
  const { email, phone } = (body ?? {}) as { email?: unknown; phone?: unknown };
  const identifier = typeof email === "string" ? email.trim().toLowerCase()
    : typeof phone === "string" ? phone.replace(/[\s()-]/g, "") : "";
  return identifier ? `identifier:${createHash("sha256").update(identifier).digest("hex")}` : `ip:${ip}`;
}

export function refreshKey(body: unknown, ip: string) {
  const { refreshToken } = (body ?? {}) as { refreshToken?: unknown };
  const token = typeof refreshToken === "string" ? refreshToken : "";
  const identity = token ? createHash("sha256").update(token).digest("hex").slice(0, 20) : ip;
  return `refresh:${ip}:${identity}`;
}
