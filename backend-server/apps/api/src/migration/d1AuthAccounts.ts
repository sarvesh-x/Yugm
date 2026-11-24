import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import type { AuthAccountStore, AuthUser, IdentityPatch } from "../services/authAccounts.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { AUTH_PROFILE_ARRAYS, AUTH_PROFILE_FIELDS, PROFILE_NESTED_FIELDS } from "./authProfileFields.js";
import { D1TargetWriter } from "./d1Target.js";
import { applyMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";

type UserRow = Record<string, string | number | null>;

function column(field: string) {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

const arrayFields = Object.entries(AUTH_PROFILE_ARRAYS);
const dateFields = new Set([
  "termsAcceptedAt", "profileCompletedAt", "deletionRequestedAt", "lastDailyCheckInAt",
  "vipStartedAt", "vipExpiresAt", "vipFreezeStartedAt"
]);
const booleanFields = new Set(["vipFrozen", "emailVerified", "isVerified"]);
const fields = [
  ...AUTH_PROFILE_FIELDS, "name", "username", "role", "phone", "firebaseUid", "tokenVersion",
  "termsAcceptedAt", "profileCompletedAt", "deletionRequestedAt", "xp", "lastDailyCheckInAt",
  "vipLevel", "vipExp", "vipExpiresAt", "vipFrozen", "vipFreezeStartedAt", "emailVerified", "isVerified"
];
const userColumns = [
  "source_id", ...fields.map(column),
  ...PROFILE_NESTED_FIELDS.flatMap(([field, keys]) => keys.map((key) => `${column(field)}_${column(key)}`))
].map((name) => `u.${name}`).join(", ");
const readUser = `SELECT ${userColumns}, p.null_fields, ${arrayFields.map(([field, table]) => `(
  SELECT json_group_array(value) FROM (SELECT value FROM ${table} WHERE users_id = u.source_id ORDER BY position)
) AS ${column(field)}_json`).join(", ")} FROM users AS u
LEFT JOIN user_auth_profile AS p ON p.source_id = u.source_id`;

function restoreAuthUser(row: UserRow): AuthUser {
  const nulls = new Set<string>(JSON.parse(String(row.null_fields ?? "[]")));
  const document = { id: String(row.source_id) } as Record<string, unknown> & { id: string };
  for (const field of fields) {
    const value = row[column(field)];
    document[field] = nulls.has(field) ? null : value == null ? undefined
      : dateFields.has(field) ? new Date(String(value)) : booleanFields.has(field) ? Boolean(value) : value;
  }
  for (const [field] of arrayFields) {
    document[field] = nulls.has(field) ? null : JSON.parse(String(row[`${column(field)}_json`]));
  }
  for (const [field, keys] of PROFILE_NESTED_FIELDS) {
    if (nulls.has(field)) {
      document[field] = null;
      continue;
    }
    const values: Record<string, unknown> = {};
    for (const key of keys) {
      const value = row[`${column(field)}_${column(key)}`];
      if (nulls.has(`${field}.${key}`)) values[key] = null;
      else if (value !== null) values[key] = value;
    }
    document[field] = values;
  }
  return document as AuthUser;
}

function sqlValue(value: string | boolean | Date | undefined, field: keyof IdentityPatch) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "string" && (field === "name" || field === "username")) return value.trim();
  return value ?? null;
}

export function createD1AuthAccountStore(db: D1Database): AuthAccountStore {
  const writer = new D1TargetWriter(db);

  async function find(field: "source_id" | "firebase_uid" | "email", value: string) {
    const row = await db.prepare(`${readUser} WHERE u.${field} = ?`).bind(value).first<UserRow>();
    return row && restoreAuthUser(row);
  }

  return {
    findById: (id) => find("source_id", id),
    findByUid: (uid) => find("firebase_uid", uid),
    async findByEmail(email) {
      const user = await find("email", email);
      return user && { ...user, phone: undefined };
    },
    async findByPhones(phones) {
      const { results } = await db.prepare(`
        ${readUser} WHERE u.phone IN (${phones.map(() => "?").join(", ")}) LIMIT 2
      `).bind(...phones).all<UserRow>();
      if (results.length > 1) {
        throw new HttpError(409, "Multiple accounts share this phone number. Contact support to recover the account.", ErrorCode.CONFLICT);
      }
      return results[0] ? restoreAuthUser(results[0]) : null;
    },
    async usernameExists(username) {
      return Boolean(await db.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first());
    },
    async insert(input) {
      const now = new Date();
      const user: AuthUser = {
        ...input, id: randomBytes(12).toString("hex"), name: input.name.trim(), username: input.username.trim().toLowerCase(),
        email: input.email?.trim().toLowerCase(), phone: input.phone?.trim(), role: "USER", tokenVersion: 0,
        xp: 0, vipLevel: 0, vipExp: 0, vipFrozen: false, followersCount: 0, followingCount: 0,
        hobbies: [], ownedCosmeticIds: [], avatarParts: {}, activeCosmetics: {}
      };
      const { id, avatarParts, activeCosmetics, ...fields } = user;
      const context = new TransformContext("auth-signup");
      const mapped = applyMapping("users", JSON.parse(JSON.stringify({
        ...fields, _id: id, profileMedia: [], createdAt: now, updatedAt: now
      })), context);
      context.assertAccountedFor();
      if (mapped.rejected || context.quarantine.length) {
        throw new HttpError(400, "Invalid account fields", ErrorCode.VALIDATION);
      }
      await writer.writeBatch(mapped.writes);
      return user;
    },
    async updateIdentity(user, patch) {
      const keys = Object.keys(patch) as (keyof IdentityPatch)[];
      const guards = [...new Set<keyof IdentityPatch>(["firebaseUid", "deletionRequestedAt", ...keys])];
      const match = `source_id = ? AND ${guards.map((field) => `${column(field)} IS ?`).join(" AND ")}`;
      const values = [user.id, ...guards.map((field) => sqlValue(user[field], field))];
      const [, updated] = await db.batch([
        db.prepare(`
          UPDATE user_auth_profile
          SET null_fields = (SELECT json_group_array(value) FROM json_each(null_fields)
            WHERE value NOT IN (${keys.map(() => "?").join(", ")}))
          WHERE source_id = ? AND EXISTS (SELECT 1 FROM users WHERE ${match})
        `).bind(...keys, user.id, ...values),
        db.prepare(`
          UPDATE users SET ${keys.map((field) => `${column(field)} = ?`).join(", ")}, updated_at = ?
          WHERE ${match} RETURNING source_id
        `).bind(...keys.map((field) => sqlValue(patch[field], field)), new Date().toISOString(), ...values)
      ]);
      return updated.results.length ? find("source_id", user.id) : null;
    },
    isIdentityConflict(error) {
      return error instanceof Error && /UNIQUE constraint failed/.test(error.message);
    }
  };
}
