import crypto from "node:crypto";
import { env } from "../config/env.js";

const algorithm = "aes-256-gcm";

function key(): Buffer {
  if (!env.PAYOUT_KYC_ENCRYPTION_KEY) {
    throw new Error("PAYOUT_KYC_ENCRYPTION_KEY is required to encrypt sensitive KYC fields");
  }
  return crypto.createHash("sha256").update(env.PAYOUT_KYC_ENCRYPTION_KEY).digest();
}

export function encryptSensitiveField(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSensitiveField(value?: string | null) {
  if (!value) return undefined;
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return undefined;
  const decipher = crypto.createDecipheriv(algorithm, key(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function last4(value?: string | null) {
  const compact = value?.replace(/\s+/g, "") ?? "";
  return compact.length >= 4 ? compact.slice(-4) : undefined;
}

export function maskUpi(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const [name, domain] = normalized.split("@");
  if (!name || !domain) return "***";
  const prefix = name.slice(0, Math.min(2, name.length));
  return `${prefix}${"*".repeat(Math.max(3, name.length - prefix.length))}@${domain}`;
}
