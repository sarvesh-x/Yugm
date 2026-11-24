import type { D1Database } from "@cloudflare/workers-types";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { moderateContent } from "../services/contentModeration.js";
import type { AccessClaims } from "../services/accessSession.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { d1UserId } from "./d1People.js";
import {
  anniversaryLeadMs, bondConfigValues, bondDefaults, bondKinds, bondLevel, bondLevels, bondRewardItems,
  dayMs, giftSeeds, milestones, nextAnniversary, rankingPeriod, rankingWindows, weeklyPeriod,
  type BondKind, type RankingWindow
} from "../services/bondRulesCore.js";

type SqlValue = string | number | null;
type UserRow = {
  source_id: string; name: string; username: string; avatar: string | null; avatar_type: string | null;
  age: number | null; is_blocked: number; deletion_requested_at: string | null; suspended_until: string | null;
  bond_invitations: number; bond_notifications: number; wallet_balance: number; charm_exp: number;
  xp: number; level: number; last_daily_check_in_at: string | null; restricted: number; person_json: string;
};
type BondRow = {
  source_id: string; pair_key: string; kind: string; status: string; activated_at: string;
  ended_at: string | null; ended_by: string | null; points: number; version: number;
  next_milestone_at: string | null; anniversary_reminder_at: string | null;
  users_json: string; slots_json: string; milestones_json: string; preferences_json: string;
};
type BondRequestRow = {
  source_id: string; pair_key: string; sender_id: string; recipient_id: string; kind: string;
  bond_id: string | null; slot: number | null; gift_id: string | null; gift_name: string | null;
  gift_icon: string | null; price: number; gift_points: number; message: string | null; status: string;
  expires_at: string; resolved_at: string | null; key: string; version: number; created_at: string | null;
};
type GiftRow = {
  source_id: string; name: string; icon: string; coin_price: number; bond_purpose: string | null;
  bond_kind: string | null; bond_points: number; bond_minimum_days: number; bond_cosmetic_id: string | null;
};
type BondPreferences = {
  visibility: "PRIVATE" | "FRIENDS" | "PUBLIC"; showDuration: boolean; showLevel: boolean; showBadge: boolean;
  leaderboard: boolean; showRanking: boolean; reminders: boolean; announcements: boolean;
};
type BondView = {
  id: string; pairKey: string; kind: string; kindName: string; status: string; activatedAt: string; endedAt: string | null;
  days: number; points: number; version: number; milestoneDays: number[]; nextMilestoneAt: string | null;
  nextAnniversaryAt: string | null; users: string[]; slots: (number | null)[]; preferences: Record<string, BondPreferences>;
  level: number; levelName: string; levelStart: number; nextThreshold: number | null;
};
type Actor = { user: { id: string }; claims: AccessClaims };

const newId = () => randomBytes(12).toString("hex");
const giftIdFor = (name: string) => createHash("sha256").update(`bond-gift:${name}`).digest("hex").slice(0, 24);
const snake = (value: string) => value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const pairKey = (a: string, b: string) => [a, b].sort().join(":");
const compact = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));
const asDate = (value: string | null | undefined) => value ? new Date(value) : undefined;
const json = (value: unknown) => JSON.stringify(value);
const capacity = () => env.YUGM_BOND_SLOTS;
const bondEnabled = () => env.YUGM_BONDS_ENABLED ?? env.NODE_ENV !== "production";
const recipientShare = (amount: number) => amount - Math.floor(amount * 10 / 100);

const userFields = `u.source_id, u.name, u.username, u.avatar, u.avatar_type, u.age, u.is_blocked,
  u.deletion_requested_at, u.suspended_until, u.bond_invitations, u.bond_notifications,
  u.wallet_balance, u.charm_exp, u.xp, u.level, u.last_daily_check_in_at,
  EXISTS (SELECT 1 FROM user_safety_statuses AS s WHERE s.user_id = u.source_id
    AND (s.is_chat_restricted = 1 OR s.is_shadow_banned = 1)) AS restricted`;
const bondPersonJson = (alias: string) => `json_object('id', ${alias}.source_id, 'name', ${alias}.name,
  'username', ${alias}.username, 'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${snake(key)}`).join(", ")}))`;
const walletFrozen = `EXISTS (SELECT 1 FROM user_safety_statuses AS s WHERE s.user_id = u.source_id AND s.is_wallet_frozen = 1)`;
const pairBlocked = `(EXISTS (SELECT 1 FROM blocks AS b WHERE (b.blocker_id = ?1 AND b.blocked_user_id = ?2)
  OR (b.blocker_id = ?2 AND b.blocked_user_id = ?1)))`;
const pairFriends = `(EXISTS (SELECT 1 FROM friendships AS f WHERE f.status = 'ACCEPTED'
  AND ((f.user_id = ?1 AND f.friend_id = ?2) OR (f.user_id = ?2 AND f.friend_id = ?1))))`;

// Bonds' legacy person DTO always exposes these keys, with null for absent values.
function bondPerson(record: string) {
  const value = JSON.parse(record) as Record<string, unknown>;
  const parts = compact(value.avatarParts as Record<string, unknown>);
  return { id: value.id, name: value.name, username: value.username ?? null, avatar: value.avatar ?? null,
    avatarType: value.avatarType ?? null, avatarParts: Object.keys(parts).length ? parts : null };
}

function memberAvailable(user: UserRow | undefined, now = new Date()) {
  return !!user && (user.age ?? 0) >= 18 && !user.is_blocked && !user.deletion_requested_at &&
    (!user.suspended_until || new Date(user.suspended_until) <= now);
}

async function readUsers(db: D1Database, ids: string[]) {
  if (!ids.length) return new Map<string, UserRow>();
  const { results } = await db.prepare(`SELECT ${userFields}, ${bondPersonJson("u")} AS person_json
    FROM users AS u WHERE u.source_id IN (SELECT value FROM json_each(?))`)
    .bind(json([...new Set(ids)])).all<UserRow>();
  return new Map(results.map(row => [row.source_id, row]));
}

async function blockedPair(db: D1Database, a: string, b: string) {
  const row = await db.prepare(`SELECT ${pairBlocked} AS blocked`).bind(a, b).first<{ blocked: number }>();
  return Boolean(row?.blocked);
}

async function isWalletFrozen(db: D1Database, userId: string) {
  const row = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE u.source_id = ?`)
    .bind(userId).first<{ frozen: number }>();
  return Boolean(row?.frozen);
}

async function eligiblePair(db: D1Database, from: string, to: string, now: Date,
  requireFriend = true, requireInvites = true) {
  const { results } = await db.prepare(`SELECT ${userFields}, ${pairBlocked} AS blocked,
    ${pairFriends} AS friend FROM users AS u WHERE u.source_id IN (?1, ?2)`)
    .bind(from, to).all<UserRow & { blocked: number; friend: number }>();
  if (results.length !== 2 || results.some(row => !memberAvailable(row, now))) {
    throw new HttpError(403, "This bond action is unavailable", ErrorCode.FORBIDDEN);
  }
  if (results.some(row => row.blocked)) throw new HttpError(403, "This bond action is unavailable", ErrorCode.FORBIDDEN);
  if (requireInvites && results.find(row => row.source_id === to)?.bond_invitations === 0) {
    throw new HttpError(403, "This bond action is unavailable", ErrorCode.FORBIDDEN);
  }
  if (requireFriend && !results.some(row => row.friend)) {
    throw new HttpError(403, "Only accepted friends can create a bond", ErrorCode.FORBIDDEN);
  }
  if (results.some(row => row.restricted)) throw new HttpError(403, "This bond action is unavailable", ErrorCode.FORBIDDEN);
  return results;
}

const bondSelectColumns = `b.*,
  (SELECT json_group_array(value) FROM (SELECT value FROM bond_users WHERE bonds_id = b.source_id ORDER BY position)) AS users_json,
  (SELECT json_group_array(value) FROM (SELECT value FROM bond_slots WHERE bonds_id = b.source_id ORDER BY position)) AS slots_json,
  (SELECT json_group_array(day) FROM (SELECT day FROM bond_milestones WHERE bonds_id = b.source_id ORDER BY position)) AS milestones_json,
  (SELECT json_group_array(json_object('key', key, 'value', json(value_json))) FROM
    (SELECT key, value_json FROM bond_preferences WHERE bonds_id = b.source_id ORDER BY position)) AS preferences_json`;
const bondSelect = `SELECT ${bondSelectColumns} FROM bonds AS b`;

const preferenceFlags = ["showDuration", "showLevel", "showBadge", "leaderboard", "showRanking", "reminders", "announcements"] as const;

// Imported rows store boolean preferences as 0/1 in value_json; Bonds' DTO must still return booleans.
function storedPreferences(value: BondPreferences): BondPreferences {
  const result = { ...value };
  for (const flag of preferenceFlags) result[flag] = Boolean(value[flag]);
  return result;
}

function viewBond(row: BondRow, now = new Date()): BondView {
  const preferences: Record<string, BondPreferences> = {};
  for (const entry of JSON.parse(row.preferences_json || "[]") as Array<{ key: string; value: BondPreferences }>) {
    preferences[entry.key] = storedPreferences(entry.value);
  }
  const level = bondLevel(row.points);
  const end = asDate(row.ended_at) ?? now;
  return {
    id: row.source_id, pairKey: row.pair_key, kind: row.kind, kindName: bondKinds[row.kind as BondKind]?.name ?? row.kind,
    status: row.status, activatedAt: row.activated_at, endedAt: row.ended_at,
    days: Math.max(0, Math.floor((end.getTime() - new Date(row.activated_at).getTime()) / dayMs)),
    points: row.points, version: row.version, milestoneDays: JSON.parse(row.milestones_json || "[]") as number[],
    nextMilestoneAt: row.next_milestone_at,
    nextAnniversaryAt: row.status === "ACTIVE" ? nextAnniversary(new Date(row.activated_at), now).toISOString() : null,
    users: JSON.parse(row.users_json || "[]") as string[], slots: JSON.parse(row.slots_json || "[]") as (number | null)[],
    preferences, ...level
  };
}

function describeBond(bond: BondView) {
  return { id: bond.id, kind: bond.kind, kindName: bond.kindName, status: bond.status,
    activatedAt: bond.activatedAt, endedAt: bond.endedAt, days: bond.days, points: bond.points,
    version: bond.version, level: bond.level, levelName: bond.levelName, levelStart: bond.levelStart,
    nextThreshold: bond.nextThreshold, milestoneDays: bond.milestoneDays,
    nextMilestoneAt: bond.nextMilestoneAt, nextAnniversaryAt: bond.nextAnniversaryAt };
}

function preferencesFor(bond: BondView, actor: string): BondPreferences {
  return storedPreferences({ ...bondDefaults, ...(bond.preferences[actor] ?? {}) });
}

async function readBond(db: D1Database, id: string, actor?: string) {
  const row = await db.prepare(`${bondSelect} WHERE b.source_id = ? ${actor
    ? "AND EXISTS (SELECT 1 FROM bond_users AS bu WHERE bu.bonds_id = b.source_id AND bu.value = ?)" : ""}`)
    .bind(...(actor ? [id, actor] : [id])).first<BondRow>();
  if (!row) throw new HttpError(404, "Bond not found", ErrorCode.NOT_FOUND);
  return viewBond(row);
}

async function readActiveBond(db: D1Database, id: string, actor: string) {
  const bond = await readBond(db, id, actor);
  if (bond.status !== "ACTIVE") throw new HttpError(409, "This bond has ended", ErrorCode.CONFLICT);
  return bond;
}

async function activeBondSlots(db: D1Database, userId: string) {
  const { results } = await db.prepare(`SELECT sl.value FROM bond_slots AS sl
    JOIN bond_users AS bu ON bu.bonds_id = sl.bonds_id AND bu.position = sl.position
    JOIN bonds AS b ON b.source_id = sl.bonds_id WHERE bu.value = ? AND b.status = 'ACTIVE'`)
    .bind(userId).all<{ value: number | null }>();
  return new Set(results.map(row => row.value));
}

async function openSlots(db: D1Database, userId: string, now: Date) {
  const row = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM bond_slots AS sl
      JOIN bond_users AS bu ON bu.bonds_id = sl.bonds_id AND bu.position = sl.position
      JOIN bonds AS b ON b.source_id = sl.bonds_id WHERE bu.value = ?1 AND b.status = 'ACTIVE') +
    (SELECT COUNT(*) FROM bond_requests AS r WHERE r.sender_id = ?1 AND r.status = 'PENDING'
      AND r.bond_id IS NULL AND r.expires_at > ?2) AS used,
    EXISTS (SELECT 1 FROM user_safety_statuses AS s WHERE s.user_id = ?1
      AND (s.is_chat_restricted = 1 OR s.is_shadow_banned = 1)) AS restricted`)
    .bind(userId, now.toISOString()).first<{ used: number; restricted: number }>();
  if (row?.restricted) return [];
  const used = new Set((await db.prepare(`SELECT sl.value FROM bond_slots AS sl
    JOIN bond_users AS bu ON bu.bonds_id = sl.bonds_id AND bu.position = sl.position
    JOIN bonds AS b ON b.source_id = sl.bonds_id WHERE bu.value = ?1 AND b.status = 'ACTIVE'
    UNION SELECT slot AS value FROM bond_requests WHERE sender_id = ?1 AND status = 'PENDING'
      AND bond_id IS NULL AND expires_at > ?2`).bind(userId, now.toISOString()).all<{ value: number | null }>())
    .results.map(item => item.value));
  return Array.from({ length: capacity() }, (_, index) => index + 1).filter(slot => !used.has(slot));
}

async function usersWithOpenSlots(db: D1Database, ids: string[], now: Date) {
  const out = new Set<string>();
  for (const id of [...new Set(ids)]) {
    if ((await openSlots(db, id, now)).length) out.add(id);
  }
  return out;
}

async function ensureD1BondCatalog(db: D1Database) {
  const time = new Date().toISOString();
  const gifts = giftSeeds.map(gift => {
    const id = giftIdFor(gift.name);
    const purpose = gift.bondPurpose;
    const kind = "bondKind" in gift ? gift.bondKind : null;
    const minimumDays = "bondMinimumDays" in gift ? gift.bondMinimumDays : 0;
    const cosmetic = "bondCosmeticId" in gift ? gift.bondCosmeticId : null;
    return db.prepare(`INSERT INTO gifts (source_id, name, icon, coin_price, pk_points, diamond_price, is_active,
      effect3d, interactive, animation_key, expires_at, combo_multiplier, category, bond_purpose, bond_kind,
      bond_points, bond_minimum_days, bond_cosmetic_id, theme, rarity, limited_edition_active,
      limited_edition_total, limited_edition_remaining, tradable, upgradeable, achievement_gift, pet_gift,
      vehicle_gift, created_at, updated_at)
      SELECT ?, ?, ?, ?, 0, 0, 1, '', 0, '', NULL, 1, 'bonds', ?, ?, ?, ?, ?, '', 'rare', 0, 0, 0, 0, 0, 0, 0, 0, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM gifts WHERE source_id = ?)`)
      .bind(id, gift.name, gift.icon, gift.coinPrice, purpose, kind, gift.bondPoints, minimumDays, cosmetic, time, time, id);
  });
  const cosmetics = [
    { id: bondRewardItems.milestone, name: "Shared Memories", type: "PROFILE_BADGE", rarity: "RARE", preview: "✦" },
    { id: bondRewardItems.weekly, name: "Bonds Champion", type: "AVATAR_FRAME", rarity: "EPIC", preview: "✧" }
  ].map(item => db.prepare(`INSERT INTO cosmetics (source_id, type, name, coin_price, rarity, preview,
    is_active, reward_only, created_at, updated_at) SELECT ?, ?, ?, 0, ?, ?, 1, 1, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM cosmetics WHERE source_id = ?)`)
    .bind(item.id, item.type, item.name, item.rarity, item.preview, time, time, item.id));
  await db.batch([...gifts, ...cosmetics]);
}

async function readGift(db: D1Database, id: string, purposes: string[], kind: string | undefined, now: Date) {
  const { results } = await db.prepare(`SELECT source_id, name, icon, coin_price, bond_purpose, bond_kind,
    bond_points, bond_minimum_days, bond_cosmetic_id FROM gifts WHERE source_id = ?
    AND category = 'bonds' AND is_active = 1 AND bond_purpose IN (SELECT value FROM json_each(?))
    AND (expires_at IS NULL OR expires_at > ?) AND (? IS NULL OR bond_kind = ?)`)
    .bind(id, json(purposes), now.toISOString(), kind ?? null, kind ?? null).all<GiftRow>();
  return results[0];
}

function notification(db: D1Database, userId: string, data: Record<string, string>, title: string, body: string,
  time: string, guard = "1 = 1", ...guardValues: SqlValue[]) {
  return db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
    SELECT ?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ? WHERE ${guard}`)
    .bind(newId(), userId, title, body, json({ type: "BONDS", ...data }), time, time, ...guardValues);
}

function bumpVersions(db: D1Database, a: string, b: string, time: string, guard: string, ...values: SqlValue[]) {
  return db.prepare(`UPDATE users SET bond_version = bond_version + 1, updated_at = ?
    WHERE source_id IN (?, ?) AND ${guard}`).bind(time, a, b, ...values);
}

function debit(db: D1Database, actor: Actor, user: UserRow, amount: number, source: string,
  metadata: Record<string, unknown>, time: string, guard: string, ...guardValues: SqlValue[]) {
  const id = newId();
  const key = typeof metadata.idempotencyKey === "string" ? metadata.idempotencyKey : id;
  return {
    id,
    claim: db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount,
      balance_before, balance_after, metadata, created_at, updated_at)
      SELECT ?, u.source_id, 'DEBIT', ?, ?, u.wallet_balance, u.wallet_balance - ?, ?, ?, ?
      FROM users AS u WHERE ${d1LiveUserFilter} AND NOT ${walletFrozen} AND u.wallet_balance = ?
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions AS w
          WHERE w.user_id = u.source_id AND json_extract(w.metadata, '$.idempotencyKey') = ?)
        AND ${guard}`)
      .bind(id, source, amount, amount, json(metadata), time, time, ...bindD1LiveUser(actor.claims, time),
        user.wallet_balance, key, ...guardValues),
    apply: db.prepare(`UPDATE users SET wallet_balance = ? WHERE source_id = ? AND wallet_balance = ?
      AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
      .bind(user.wallet_balance - amount, user.source_id, user.wallet_balance, id)
  };
}

function credit(db: D1Database, user: UserRow, amount: number, source: string,
  metadata: Record<string, unknown>, time: string, guard: string, ...guardValues: SqlValue[]) {
  const id = newId();
  const key = typeof metadata.idempotencyKey === "string" ? metadata.idempotencyKey : id;
  const share = Math.floor(Number(metadata.platformFee) || 0);
  return {
    id,
    claim: db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount,
      balance_before, balance_after, metadata, created_at, updated_at, credited_at)
      SELECT ?, u.source_id, 'CREDIT', ?, ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ?
      FROM users AS u WHERE u.source_id = ? AND u.wallet_balance = ?
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions AS w
          WHERE w.user_id = u.source_id AND json_extract(w.metadata, '$.idempotencyKey') = ?)
        AND ${guard}`)
      .bind(id, source, amount, amount, json(metadata), time, time, time, user.source_id, user.wallet_balance, key, ...guardValues),
    apply: db.prepare(`UPDATE users SET wallet_balance = ?, charm_exp = charm_exp + ?
      WHERE source_id = ? AND wallet_balance = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
      .bind(user.wallet_balance + amount, source === "GIFT_RECEIVED_DM" ? amount + share : 0,
        user.source_id, user.wallet_balance, id)
  };
}

const requestClaim = (id: string, status: string, at: string) =>
  `EXISTS (SELECT 1 FROM bond_requests WHERE source_id = ? AND status = ? AND resolved_at = ?)`;

async function closeRequest(db: D1Database, row: BondRequestRow, outcome: string, now: Date,
  note?: { title: string; body: string; kind: string }) {
  const time = now.toISOString();
  const claimId = newId();
  const sender = (await readUsers(db, [row.sender_id])).get(row.sender_id);
  const statements = [
    db.prepare(`UPDATE bond_requests SET status = ?, resolved_at = ?, version = version + 1, updated_at = ?
      WHERE source_id = ? AND status = 'PENDING'`).bind(outcome, time, time, row.source_id),
    bumpVersions(db, row.sender_id, row.recipient_id, time,
      requestClaim(row.source_id, outcome, time), row.source_id, outcome, time)
  ];
  if (sender && row.price > 0) {
    const released = credit(db, sender, row.price, "BOND_RELEASE", {
      idempotencyKey: `bond:release:${row.source_id}`, invitationId: row.source_id
    }, time, requestClaim(row.source_id, outcome, time), row.source_id, outcome, time);
    statements.push(released.claim, released.apply);
  }
  if (note) {
    statements.push(notification(db, row.sender_id, { kind: note.kind, requestId: row.source_id },
      note.title, note.body, time, requestClaim(row.source_id, outcome, time), row.source_id, outcome, time));
  }
  const [closed] = await db.batch(statements);
  return closed.meta.changes > 0;
}

export async function expireD1BondRequests(db: D1Database, now = new Date(), userId?: string) {
  const rows = await db.prepare(`SELECT * FROM bond_requests WHERE status = 'PENDING' AND expires_at <= ?
    ${userId ? "AND (sender_id = ? OR recipient_id = ?)" : ""} ORDER BY expires_at, source_id LIMIT 100`)
    .bind(...(userId ? [now.toISOString(), userId, userId] : [now.toISOString()])).all<BondRequestRow>();
  for (const row of rows.results) {
    await closeRequest(db, row, "EXPIRED", now, {
      kind: "EXPIRED", title: "Bond invitation expired",
      body: "The invitation slot and any held coins are available again."
    });
  }
  return rows.results.length;
}

function bondPointId(bondId: string, key: string) {
  return `${bondId}:${key}`;
}

function pointClaim(db: D1Database, bondId: string, key: string, kind: string, points: number,
  support: number, actorId: string | null, time: string, guard = "1 = 1", ...values: SqlValue[]) {
  return db.prepare(`INSERT INTO bond_points (source_id, bond_id, actor_id, key, kind, points, support, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM bond_points WHERE source_id = ?)
      AND EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND status = 'ACTIVE') AND ${guard}`)
    .bind(bondPointId(bondId, key), bondId, actorId, key, kind, points, support, time, time,
      bondPointId(bondId, key), bondId, ...values);
}

function updateBondPoints(db: D1Database, bond: BondView, pointKey: string, awarded: number, time: string) {
  const statements: D1PreparedStatementLike[] = [
    db.prepare(`UPDATE bonds SET points = points + ?, version = version + 1, updated_at = ?
      WHERE source_id = ? AND status = 'ACTIVE' AND version = ? AND EXISTS (SELECT 1 FROM bond_points WHERE source_id = ?)`)
      .bind(awarded, time, bond.id, bond.version, bondPointId(bond.id, pointKey))
  ];
  const before = bondLevel(bond.points).level;
  const after = bondLevel(bond.points + awarded).level;
  if (after > before) {
    for (const userId of bond.users) {
      statements.push(notification(db, userId, { kind: "LEVEL_UP", bondId: bond.id },
        "Your bond reached a new level", `Your shared bond is now level ${after}.`, time));
    }
  }
  return statements;
}

type D1PreparedStatementLike = ReturnType<D1Database["prepare"]>;

async function settleGift(db: D1Database, actor: Actor, input: {
  bond: BondView; sender: string; recipient: string; gift: GiftRow; amount: number; points: number;
  key: string; held: boolean; senderRow: UserRow; recipientRow: UserRow; startOfDay: string;
  guard: string; guardValues: SqlValue[];
}) {
  const { bond, sender, recipient, gift, amount, key, held, guard, guardValues } = input;
  const time = new Date().toISOString();
  const metadata = {
    idempotencyKey: `bond:gift:${key}`, bondId: bond.id, giftId: gift.source_id,
    platformFee: amount - recipientShare(amount)
  };
  const giftTxnId = newId();
  const txnClaim = db.prepare(`INSERT INTO gift_transactions (source_id, sender_id, receiver_id, gift_id,
    coin_amount, diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, 0, 'COINS', 'send', 1, ?, '', ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM gift_transactions AS t
      WHERE t.sender_id = ? AND json_extract(t.metadata, '$.idempotencyKey') = ?) AND ${guard}`)
    .bind(giftTxnId, sender, recipient, gift.source_id, amount, amount, json(metadata), time, time,
      sender, metadata.idempotencyKey, ...guardValues);
  const statements: D1PreparedStatementLike[] = [txnClaim];
  const txnGuard = "EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)";
  if (!held) {
    const paid = debit(db, actor, input.senderRow, amount, "GIFT_SENT_DM", metadata, time,
      `${txnGuard} AND ${guard}`, giftTxnId, ...guardValues);
    statements.push(paid.claim, paid.apply);
  }
  const received = credit(db, input.recipientRow, recipientShare(amount), "GIFT_RECEIVED_DM", metadata, time,
    `${txnGuard} AND ${guard}`, giftTxnId, ...guardValues);
  statements.push(received.claim, received.apply);
  statements.push(db.prepare(`UPDATE users SET wealth_exp = wealth_exp + ?
    WHERE source_id = ? AND ${txnGuard}`).bind(amount, sender, giftTxnId));

  const daily = await db.prepare(`SELECT COALESCE(SUM(points), 0) AS total FROM bond_points
    WHERE bond_id = ? AND kind = 'GIFT' AND created_at >= ?`).bind(bond.id, input.startOfDay).first<{ total: number }>();
  const awarded = Math.min(input.points, Math.max(0, bondConfigValues.dailyGiftPoints - (daily?.total ?? 0)));
  statements.push(pointClaim(db, bond.id, giftTxnId, "GIFT", awarded, amount, sender, time));
  statements.push(...updateBondPoints(db, bond, giftTxnId, awarded, time));

  if (gift.bond_cosmetic_id) {
    const rewardKey = `bond:gift:${key}`;
    for (const userId of bond.users) {
      statements.push(db.prepare(`INSERT INTO bond_rewards (source_id, bond_id, user_id, key, item_id, granted_at, expires_at, expired_at)
        SELECT ?, ?, ?, ?, ?, ?, NULL, NULL WHERE NOT EXISTS (
          SELECT 1 FROM bond_rewards WHERE bond_id = ? AND user_id = ? AND key = ?) AND ${txnGuard}`)
        .bind(`${giftTxnId}:reward:${userId}`, bond.id, userId, rewardKey, gift.bond_cosmetic_id, time,
          bond.id, userId, rewardKey, giftTxnId));
      statements.push(db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = ?), 0)
        WHERE EXISTS (SELECT 1 FROM bond_rewards WHERE bond_id = ? AND user_id = ? AND key = ?)`)
        .bind(`${giftTxnId}:owned:${userId}`, gift.bond_cosmetic_id, userId, userId, bond.id, userId, rewardKey));
    }
  }
  return { statements, id: giftTxnId, awarded };
}

function validateMessage(message: string | undefined) {
  if (!message) return;
  const result = moderateContent(message);
  if (result.action === "BLOCK" || result.severity === "HIGH") {
    throw new HttpError(400, "Content was blocked by auto-moderation", ErrorCode.CONTENT_BLOCKED);
  }
}

async function sendRequest(db: D1Database, actor: Actor, input: {
  recipient: string; kind: BondKind; slot?: number; giftId?: string; message?: string; key: string; bondId?: string;
}) {
  const sender = actor.user.id;
  const recipient = d1UserId(input.recipient);
  if (sender === recipient) throw new HttpError(403, "You cannot invite yourself", ErrorCode.FORBIDDEN);
  const pair = pairKey(sender, recipient);
  await expireD1BondRequests(db, new Date(), sender);
  const existing = await db.prepare("SELECT * FROM bond_requests WHERE sender_id = ? AND key = ? ORDER BY created_at DESC LIMIT 1")
    .bind(sender, input.key).first<BondRequestRow>();
  if (existing) {
    const same = String(existing.recipient_id) === recipient && existing.kind === input.kind &&
      existing.slot === (input.slot ?? null) && String(existing.gift_id ?? "") === (input.giftId ?? "") &&
      (existing.message ?? "") === (input.message ?? "");
    if (!same) throw new HttpError(409, "This request key was already used", ErrorCode.CONFLICT);
    return { id: existing.source_id, status: existing.status };
  }
  const now = new Date();
  const time = now.toISOString();
  await eligiblePair(db, sender, recipient, now, !input.bondId, true);
  const pending = await db.prepare(`SELECT source_id FROM bond_requests WHERE pair_key = ? AND status = 'PENDING' LIMIT 1`)
    .bind(pair).first();
  if (pending) throw new HttpError(409, "A request is already pending", ErrorCode.CONFLICT);
  const active = await db.prepare("SELECT source_id, kind FROM bonds WHERE pair_key = ? AND status = 'ACTIVE'")
    .bind(pair).first<{ source_id: string; kind: string }>();
  if (input.bondId) {
    if (active?.source_id !== input.bondId || active.kind === input.kind) {
      throw new HttpError(409, "No eligible bond to change", ErrorCode.CONFLICT);
    }
  } else {
    if (active) throw new HttpError(409, "You already have a bond together", ErrorCode.CONFLICT);
    if (!input.slot || !(await openSlots(db, sender, now)).includes(input.slot)) {
      throw new HttpError(409, "This slot is unavailable", ErrorCode.CONFLICT);
    }
    if (!(await openSlots(db, recipient, now)).length) {
      throw new HttpError(409, "Your friend has no available slots", ErrorCode.CONFLICT);
    }
  }
  const recent = await db.prepare(`SELECT COUNT(*) AS total FROM bond_requests WHERE sender_id = ? AND created_at >= ?`)
    .bind(sender, new Date(now.getTime() - dayMs).toISOString()).first<{ total: number }>();
  if ((recent?.total ?? 0) >= bondConfigValues.dailyRequestLimit) {
    throw new HttpError(429, "Daily bond request limit reached");
  }
  const cooldown = await db.prepare(`SELECT source_id FROM bond_requests WHERE pair_key = ? AND status IN ('DECLINED','CANCELLED')
    AND resolved_at > ? LIMIT 1`).bind(pair, new Date(now.getTime() - bondConfigValues.pairCooldownMs).toISOString()).first();
  if (cooldown) throw new HttpError(409, "You can send another invitation later", ErrorCode.CONFLICT);

  let gift: GiftRow | undefined;
  if (input.giftId && !input.bondId) {
    gift = await readGift(db, d1UserId(input.giftId), ["INVITATION"], input.kind, now);
    if (!gift) throw new HttpError(409, "Invitation gift is unavailable", ErrorCode.CONFLICT);
  }
  if (!gift && !input.bondId && !bondConfigValues.freeInvitations) {
    throw new HttpError(409, "Choose an invitation gift", ErrorCode.CONFLICT);
  }
  validateMessage(input.message);
  const requestId = newId();
  const expiresAt = new Date(now.getTime() + bondConfigValues.invitationHours * 3_600_000).toISOString();
  const price = gift?.coin_price ?? 0;
  const senderRow = (await readUsers(db, [sender])).get(sender);
  if (!senderRow) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (price > 0) {
    if (await isWalletFrozen(db, sender)) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    if (senderRow.wallet_balance < price) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
  }
  const hold = price > 0 ? debit(db, actor, senderRow, price, "BOND_HOLD", {
    idempotencyKey: `bond:hold:${requestId}`, invitationId: requestId
  }, time, "1 = 1") : undefined;
  const requestClaimSql = `EXISTS (SELECT 1 FROM bond_requests WHERE source_id = ? AND key = ?)`;
  const claim = db.prepare(`INSERT INTO bond_requests (source_id, pair_key, sender_id, recipient_id, kind,
    bond_id, slot, gift_id, gift_name, gift_icon, price, gift_points, message, status, expires_at,
    resolved_at, key, version, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, NULL, ?, 1, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM bond_requests WHERE key = ?)
      AND NOT EXISTS (SELECT 1 FROM bond_requests WHERE pair_key = ? AND status = 'PENDING')
      AND (${input.bondId ? "1 = 1" : "(SELECT COUNT(*) FROM bond_requests WHERE sender_id = ? AND status = 'PENDING' AND bond_id IS NULL AND expires_at > ?) < ?"})`)
    .bind(requestId, pair, sender, recipient, input.kind, input.bondId ?? null, input.slot ?? null,
      gift?.source_id ?? null, gift?.name ?? null, gift?.icon ?? null, price, gift?.bond_points ?? 0,
      input.message ?? null, expiresAt, input.key, time, time, input.key, pair,
      ...(input.bondId ? [] : [sender, time, capacity()]));
  const statements: D1PreparedStatementLike[] = [claim];
  if (hold) statements.push(hold.claim, hold.apply);
  statements.push(notification(db, recipient, {
    kind: input.bondId ? "TYPE_CHANGE" : "INVITATION", requestId
  }, "New bond request", "Open Relationship Center to review it.", time,
  requestClaimSql, requestId, input.key));
  statements.push(bumpVersions(db, sender, recipient, time, requestClaimSql, requestId, input.key));
  const [created] = await db.batch(statements);
  if (!created.meta.changes) {
    throw new HttpError(409, "A request is already pending", ErrorCode.CONFLICT);
  }
  return { id: requestId, status: "PENDING" };
}

async function resolveRequest(db: D1Database, actor: Actor, id: string,
  action: "ACCEPTED" | "DECLINED" | "CANCELLED") {
  const request = await db.prepare("SELECT * FROM bond_requests WHERE source_id = ?").bind(d1UserId(id))
    .first<BondRequestRow>();
  if (!request) throw new HttpError(404, "Bond request not found", ErrorCode.NOT_FOUND);
  const sender = request.sender_id;
  const recipient = request.recipient_id;
  if (actor.user.id !== (action === "CANCELLED" ? sender : recipient)) {
    throw new HttpError(403, "This bond action is unavailable", ErrorCode.FORBIDDEN);
  }
  await expireD1BondRequests(db, new Date(), recipient);
  const current = await db.prepare("SELECT * FROM bond_requests WHERE source_id = ?").bind(request.source_id)
    .first<BondRequestRow>();
  if (!current || current.status !== "PENDING") {
    return { status: current?.status ?? request.status, bondId: current?.bond_id ?? null };
  }
  const now = new Date();
  const time = now.toISOString();
  if (new Date(current.expires_at) <= now) {
    await closeRequest(db, current, "EXPIRED", now, {
      kind: "EXPIRED", title: "Bond request closed", body: "The slot and any held coins are available again."
    });
    return { status: "EXPIRED", bondId: null };
  }
  const pair = current.pair_key;
  if (action !== "ACCEPTED") {
    const closed = await closeRequest(db, current, action, now, action === "DECLINED" ? {
      kind: "DECLINED", title: "Bond request closed", body: "The slot and any held coins are available again."
    } : undefined);
    return { status: closed ? action : (await db.prepare("SELECT status FROM bond_requests WHERE source_id = ?")
      .bind(current.source_id).first("status")) ?? action, bondId: null };
  }

  let eligible = true;
  try {
    await eligiblePair(db, sender, recipient, now, !current.bond_id, true);
    if (current.price > 0 && await isWalletFrozen(db, sender)) {
      throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    }
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    eligible = false;
  }
  if (!eligible) {
    await closeRequest(db, current, "INVALIDATED", now, {
      kind: "INVALIDATED", title: "Bond request closed",
      body: "The slot and any held coins are available again."
    });
    return { status: "INVALIDATED", bondId: null };
  }
  let holdTransaction: { source_id: string } | undefined;
  if (current.price > 0) {
    holdTransaction = await db.prepare(`SELECT source_id FROM wallet_transactions WHERE user_id = ?
      AND type = 'DEBIT' AND source = 'BOND_HOLD' AND amount = ?
      AND json_extract(metadata, '$.idempotencyKey') = ? LIMIT 1`)
      .bind(sender, current.price, `bond:hold:${current.source_id}`).first<{ source_id: string }>() ?? undefined;
    if (!holdTransaction) throw new HttpError(409, "Gift hold requires reconciliation", ErrorCode.CONFLICT);
  }
  const resolvedAt = time;
  const acceptedBondId = current.bond_id ?? newId();
  let bond: BondView;
  let created: { senderSlot: number | null; recipientSlot: number; nextMilestoneAt: string; anniversaryAt: string } | undefined;
  if (current.bond_id) {
    const convertedRow = await db.prepare(`${bondSelect} WHERE b.source_id = ? AND b.pair_key = ? AND b.status = 'ACTIVE'`)
      .bind(current.bond_id, pair).first<BondRow>();
    if (!convertedRow || convertedRow.kind === current.kind) {
      await closeRequest(db, current, "INVALIDATED", now, {
        kind: "INVALIDATED", title: "Bond request closed",
        body: "The slot and any held coins are available again."
      });
      return { status: "INVALIDATED", bondId: null };
    }
    const converted = viewBond(convertedRow, now);
    bond = {
      ...converted, version: converted.version + 1, kind: current.kind,
      kindName: bondKinds[current.kind as BondKind]?.name ?? current.kind
    };
  } else {
    const recipientSlots = await openSlots(db, recipient, now);
    const recipientSlot = recipientSlots[0];
    if (!recipientSlot || (current.slot && (current.slot > capacity() ||
      (await activeBondSlots(db, sender)).has(current.slot)))) {
      throw new HttpError(409, "No available slot. Free a slot before accepting.", ErrorCode.CONFLICT);
    }
    const nextMilestoneAt = new Date(now.getTime() + dayMs).toISOString();
    const anniversaryAt = new Date(nextAnniversary(now, now).getTime() - anniversaryLeadMs).toISOString();
    created = { senderSlot: current.slot ?? null, recipientSlot, nextMilestoneAt, anniversaryAt };
    bond = {
      id: acceptedBondId, pairKey: pair, kind: current.kind,
      kindName: bondKinds[current.kind as BondKind]?.name ?? current.kind, status: "ACTIVE",
      activatedAt: time, endedAt: null, days: 0, points: 0, version: 1, milestoneDays: [],
      nextMilestoneAt, nextAnniversaryAt: new Date(nextAnniversary(now, now).getTime()).toISOString(),
      users: [sender, recipient], slots: [current.slot ?? null, recipientSlot], preferences: {}, ...bondLevel(0)
    };
  }
  const acceptedGuard = `EXISTS (SELECT 1 FROM bond_requests WHERE source_id = ? AND status = 'ACCEPTED' AND resolved_at = ?)`;
  const acceptClaim = db.prepare(`UPDATE bond_requests SET status = 'ACCEPTED', bond_id = ?, resolved_at = ?,
    version = version + 1, updated_at = ? WHERE source_id = ? AND status = 'PENDING' AND ${current.bond_id
      ? "EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND pair_key = ? AND status = 'ACTIVE' AND kind <> ?)"
      : "NOT EXISTS (SELECT 1 FROM bonds WHERE pair_key = ? AND status = 'ACTIVE')"}`)
    .bind(...(current.bond_id
      ? [current.bond_id, resolvedAt, time, current.source_id, current.bond_id, pair, current.kind]
      : [acceptedBondId, resolvedAt, time, current.source_id, pair]));
  const statements: D1PreparedStatementLike[] = [acceptClaim];
  if (current.bond_id) {
    const converted = await db.prepare("SELECT version FROM bonds WHERE source_id = ? AND status = 'ACTIVE'")
      .bind(current.bond_id).first<{ version: number }>();
    if (!converted) {
      await closeRequest(db, current, "INVALIDATED", now, {
        kind: "INVALIDATED", title: "Bond request closed",
        body: "The slot and any held coins are available again."
      });
      return { status: "INVALIDATED", bondId: null };
    }
    statements.push(db.prepare(`UPDATE bonds SET kind = ?, version = version + 1, updated_at = ?
      WHERE source_id = ? AND status = 'ACTIVE' AND pair_key = ? AND version = ? AND kind <> ?
        AND ${acceptedGuard}`)
      .bind(current.kind, time, current.bond_id, pair, converted.version, current.kind,
        current.source_id, resolvedAt));
  } else if (created) {
    statements.push(db.prepare(`INSERT INTO bonds (source_id, pair_key, kind, status, activated_at, ended_at,
      ended_by, points, version, next_milestone_at, anniversary_reminder_at, created_at, updated_at)
      SELECT ?, ?, ?, 'ACTIVE', ?, NULL, NULL, 0, 1, ?, ?, ?, ? WHERE ${acceptedGuard}
        AND NOT EXISTS (SELECT 1 FROM bonds WHERE pair_key = ? AND status = 'ACTIVE')`)
      .bind(acceptedBondId, pair, current.kind, time, created.nextMilestoneAt, created.anniversaryAt, time, time,
        current.source_id, resolvedAt, pair));
    for (const [index, userId] of [sender, recipient].entries()) {
      const slot = index === 0 ? created.senderSlot : created.recipientSlot;
      statements.push(db.prepare(`INSERT INTO bond_users (source_id, value, bonds_id, position)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND status = 'ACTIVE'
          AND ${acceptedGuard})`).bind(`${acceptedBondId}:user:${index}`, userId, acceptedBondId, index,
          acceptedBondId, current.source_id, resolvedAt));
      statements.push(db.prepare(`INSERT INTO bond_slots (source_id, value, bonds_id, position)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM bond_users WHERE bonds_id = ? AND value = ?)`)
        .bind(`${acceptedBondId}:slot:${index}`, slot, acceptedBondId, index, acceptedBondId, userId));
    }
  }
  if (!current.bond_id && current.gift_id && current.price > 0) {
    const gift = await readGift(db, current.gift_id, ["INVITATION"], current.kind, now);
    if (!gift) throw new HttpError(409, "Invitation gift is unavailable", ErrorCode.CONFLICT);
    const [senderRow, recipientRow] = await Promise.all([
      (await readUsers(db, [sender])).get(sender), (await readUsers(db, [recipient])).get(recipient)
    ]);
    if (!senderRow || !recipientRow) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const settled = await settleGift(db, actor, {
      bond, sender, recipient, gift, amount: current.price, points: current.gift_points,
      key: `invitation:${current.source_id}`, held: true, senderRow, recipientRow,
      startOfDay: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString(),
      guard: acceptedGuard, guardValues: [current.source_id, resolvedAt]
    });
    statements.push(...settled.statements);
  }
  statements.push(notification(db, sender, {
    kind: current.slot ? "ESTABLISHED" : "TYPE_CHANGED", bondId: acceptedBondId
  }, "Bond request accepted", "Your bond is ready to view.", time, acceptedGuard, current.source_id, resolvedAt));
  statements.push(bumpVersions(db, sender, recipient, time, acceptedGuard, current.source_id, resolvedAt));
  const [accepted] = await db.batch(statements);
  if (!accepted.meta.changes) {
    if (current.bond_id) {
      await closeRequest(db, current, "INVALIDATED", now, {
        kind: "INVALIDATED", title: "Bond request closed",
        body: "The slot and any held coins are available again."
      });
    }
    const latest = await db.prepare("SELECT status, bond_id FROM bond_requests WHERE source_id = ?")
      .bind(current.source_id).first<{ status: string; bond_id: string | null }>();
    return { status: latest?.status ?? "PENDING", bondId: latest?.bond_id ?? null };
  }
  return { status: "ACCEPTED", bondId: acceptedBondId };
}

async function terminatePair(db: D1Database, pair: string, actor: string, status: "ENDED" | "TERMINATED_BY_BLOCK" | "TERMINATED_BY_MODERATION" | "TERMINATED_BY_ACCOUNT_REMOVAL", bondId?: string) {
  const now = new Date();
  const time = now.toISOString();
  const bond = await db.prepare(`SELECT ${bondSelectColumns} FROM bonds AS b
    WHERE b.pair_key = ? AND b.status = 'ACTIVE' ${bondId ? "AND b.source_id = ?" : ""}`)
    .bind(...(bondId ? [pair, bondId] : [pair])).first<BondRow>();
  const requests = await db.prepare(`SELECT * FROM bond_requests WHERE pair_key = ? AND status = 'PENDING'`)
    .bind(pair).all<BondRequestRow>();
  const statements: D1PreparedStatementLike[] = [];
  for (const request of requests.results) {
    const sender = (await readUsers(db, [request.sender_id])).get(request.sender_id);
    const claim = requestClaim(request.source_id, "INVALIDATED", time);
    statements.push(db.prepare(`UPDATE bond_requests SET status = 'INVALIDATED', resolved_at = ?, version = version + 1
      WHERE source_id = ? AND status = 'PENDING'`).bind(time, request.source_id));
    if (sender && request.price > 0) {
      const released = credit(db, sender, request.price, "BOND_RELEASE", {
        idempotencyKey: `bond:release:${request.source_id}`, invitationId: request.source_id
      }, time, claim, request.source_id, "INVALIDATED", time);
      statements.push(released.claim, released.apply);
    }
    statements.push(notification(db, request.sender_id, { kind: "INVALIDATED", requestId: request.source_id },
      "Bond request closed", "The slot and any held coins are available again.", time,
      claim, request.source_id, "INVALIDATED", time));
  }
  if (bond) {
    const participants = JSON.parse(bond.users_json) as string[];
    statements.push(db.prepare(`UPDATE bonds SET status = ?, ended_at = ?, ended_by = ?, version = version + 1,
      updated_at = ? WHERE source_id = ? AND status = 'ACTIVE'`)
      .bind(status, time, actor, time, bond.source_id));
    if (participants.length === 2) {
      statements.push(bumpVersions(db, participants[0], participants[1], time,
        "EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND status = ? AND ended_at = ?)",
        bond.source_id, status, time));
    }
    const partner = (JSON.parse(bond.users_json) as string[]).find(id => id !== actor);
    if (partner && status === "ENDED") {
      statements.push(notification(db, partner, { kind: "ENDED", bondId: bond.source_id },
        "Bond ended", "Relationship Center has been updated.", time,
        "EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND status = ? AND ended_at = ?)",
        bond.source_id, status, time));
    }
  }
  if (statements.length) await db.batch(statements);
  return Boolean(bond);
}

export async function terminateD1BondPair(db: D1Database, actor: string, target: string) {
  return terminatePair(db, pairKey(actor, target), actor, "TERMINATED_BY_BLOCK");
}

export async function endD1UnavailableBonds(db: D1Database, actor: string,
  status: "TERMINATED_BY_MODERATION" | "TERMINATED_BY_ACCOUNT_REMOVAL") {
  const { results } = await db.prepare(`SELECT DISTINCT pair_key FROM (
    SELECT b.pair_key FROM bonds AS b JOIN bond_users AS bu ON bu.bonds_id = b.source_id
      WHERE bu.value = ? AND b.status = 'ACTIVE'
    UNION SELECT pair_key FROM bond_requests WHERE (sender_id = ? OR recipient_id = ?) AND status = 'PENDING')`)
    .bind(actor, actor, actor).all<{ pair_key: string }>();
  for (const row of results) await terminatePair(db, row.pair_key, actor, status);
}

type RankEntry = { bond_id: string; score: number; rank: number };

function grantD1Reward(db: D1Database, bondId: string, userId: string, key: string, itemId: string,
  grantedAt: string, expiresAt: string | null) {
  const id = `${bondId}:reward:${userId}:${key}`;
  return [
    db.prepare(`INSERT INTO bond_rewards (source_id, bond_id, user_id, key, item_id, granted_at, expires_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM bond_rewards WHERE bond_id = ? AND user_id = ? AND key = ?)`)
      .bind(id, bondId, userId, key, itemId, grantedAt, expiresAt, bondId, userId, key),
    db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
      SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = ?), 0)
      WHERE EXISTS (SELECT 1 FROM bond_rewards WHERE source_id = ?)`)
      .bind(`${id}:owned`, itemId, userId, userId, id)
  ];
}

// Ranks are compacted over opted-in pairs before positions are assigned, matching rankBonds().
async function rankD1Bonds(db: D1Database, category: "SUPPORT" | "ACTIVITY" | "LONGEST",
  period: ReturnType<typeof rankingPeriod>, now: Date) {
  const scoreColumn = category === "SUPPORT" ? "p.support" : "p.points";
  const pointKind = category === "SUPPORT" ? "GIFT" : "ACTIVITY";
  const { results } = await db.prepare(`SELECT b.source_id AS bond_id, b.activated_at, b.ended_at,
    ${category === "LONGEST" ? "0" : `COALESCE(SUM(${scoreColumn}), 0)`} AS score
    FROM bonds AS b ${category === "LONGEST" ? "" : `LEFT JOIN bond_points AS p ON p.bond_id = b.source_id
      AND p.kind = ? AND p.created_at >= ? AND p.created_at < ?`}
    WHERE b.status = 'ACTIVE' AND b.activated_at < ?
    GROUP BY b.source_id ORDER BY ${category === "LONGEST"
      ? "b.activated_at ASC, b.source_id ASC" : "score DESC, b.source_id ASC"} LIMIT 500`)
    .bind(...(category === "LONGEST" ? [] : [pointKind, period.start.toISOString(), period.end.toISOString()]),
      period.end.toISOString()).all<{ bond_id: string; activated_at: string; ended_at: string | null; score: number }>();
  const scores = results.map(row => ({ ...row,
    score: category === "LONGEST"
      ? Math.max(0, Math.floor(((asDate(row.ended_at) ?? now).getTime() - new Date(row.activated_at).getTime()) / dayMs))
      : row.score })).filter(row => category === "LONGEST" || row.score > 0)
    .sort((a, b) => b.score - a.score || a.bond_id.localeCompare(b.bond_id)).slice(0, 500);
  const bonds = await db.prepare(`${bondSelect} WHERE b.source_id IN (SELECT value FROM json_each(?))`)
    .bind(json(scores.map(row => row.bond_id))).all<BondRow>();
  const byId = new Map(bonds.results.map(row => [row.source_id, viewBond(row, now)]));
  const participants = await readUsers(db, bonds.results.flatMap(row => JSON.parse(row.users_json) as string[]));
  const entries: RankEntry[] = [];
  for (const score of scores) {
    const bond = byId.get(score.bond_id);
    if (!bond || bond.users.length !== 2) continue;
    if (bond.users.some(id => {
      const row = participants.get(id);
      const settings = preferencesFor(bond, id);
      return !row || !memberAvailable(row, now) || settings.leaderboard !== true ||
        settings.visibility !== "PUBLIC";
    })) continue;
    if (await blockedPair(db, bond.users[0], bond.users[1])) continue;
    entries.push({ bond_id: bond.id, score: score.score, rank: entries.length + 1 });
    if (entries.length === 50) break;
  }
  return entries;
}

async function finalizeD1BondPeriods(db: D1Database, now: Date) {
  for (const window of rankingWindows) {
    const current = rankingPeriod(now, window);
    const prior = rankingPeriod(new Date(current.start.getTime() - 1), window);
    for (const category of ["SUPPORT", "ACTIVITY", "LONGEST"] as const) {
      const existing = await db.prepare("SELECT 1 FROM bond_ranking_snapshots WHERE period = ? AND category = ?")
        .bind(prior.id, category).first();
      if (existing) continue;
      const entries = await rankD1Bonds(db, category, prior, prior.end);
      const snapshotId = `${prior.id}:${category}`;
      const statements: D1PreparedStatementLike[] = [
        db.prepare(`INSERT INTO bond_ranking_snapshots (source_id, period, category, finalized_at)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS (
            SELECT 1 FROM bond_ranking_snapshots WHERE period = ? AND category = ?)`)
          .bind(snapshotId, prior.id, category, now.toISOString(), prior.id, category),
        ...entries.map((entry, index) => db.prepare(`INSERT INTO bond_ranking_entries
          (source_id, bond_id, score, rank, bond_ranking_snapshots_id, position)
          SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
            SELECT 1 FROM bond_ranking_snapshots WHERE period = ? AND category = ?)`)
          .bind(`${snapshotId}:${index}`, entry.bond_id, entry.score, entry.rank, snapshotId, index, prior.id, category))
      ];
      if (category === "ACTIVITY") {
        for (const entry of entries.slice(0, window === "WEEK" ? 3 : 1)) {
          const row = await db.prepare(`${bondSelect} WHERE b.source_id = ? AND b.status = 'ACTIVE'`)
            .bind(entry.bond_id).first<BondRow>();
          if (!row) continue;
          const bond = viewBond(row, now);
          if (!bond.users.every(id => {
            const settings = preferencesFor(bond, id);
            return settings.visibility === "PUBLIC" && settings.leaderboard;
          })) continue;
          for (const userId of bond.users) {
            statements.push(...grantD1Reward(db, bond.id, userId, `rank:${prior.id}:ACTIVITY`,
              bondRewardItems.weekly, now.toISOString(), new Date(now.getTime() + 7 * dayMs).toISOString()));
            statements.push(notification(db, userId, { kind: "RANK_REWARD", bondId: bond.id },
              "Bond ranking reward unlocked",
              "Your Bonds Champion frame is available in Backpack for seven days.", now.toISOString()));
          }
        }
      }
      await db.batch(statements);
    }
  }
}

export function createD1BondsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = async (req: Request): Promise<Actor> => {
    const { user, claims } = await requireHttpSession(req.headers.authorization, access);
    return { user: { id: user.id }, claims };
  };
  router.use(asyncHandler(async (req, res, next) => {
    const actor = await authenticate(req);
    if (!bondEnabled()) throw new HttpError(404, "Bonds is unavailable", ErrorCode.NOT_FOUND);
    res.locals.actor = actor;
    next();
  }));

  const objectId = z.string().regex(/^[a-f\d]{24}$/i).transform(id => id.toLowerCase());
  const actionKey = z.string().trim().regex(/^[\w-]{8,80}$/);
  const kind = z.enum(Object.keys(bondKinds) as [BondKind, ...BondKind[]]);
  const inviteSchema = z.object({
    recipient: objectId, kind, slot: z.number().int().positive().max(12), giftId: objectId.optional(),
    message: z.string().trim().max(160).optional(), key: actionKey
  }).strict();
  const preferencesSchema = z.object({
    visibility: z.enum(["PRIVATE", "FRIENDS", "PUBLIC"]).optional(), showDuration: z.boolean().optional(),
    showLevel: z.boolean().optional(), showBadge: z.boolean().optional(), showRanking: z.boolean().optional(),
    leaderboard: z.boolean().optional(), reminders: z.boolean().optional(), announcements: z.boolean().optional()
  }).strict();
  const invitationSettings = z.object({ enabled: z.boolean().optional(), push: z.boolean().optional() }).strict()
    .refine(value => value.enabled !== undefined || value.push !== undefined);
  const typeChange = z.object({ kind, key: actionKey }).strict();
  const giftInput = z.object({ giftId: objectId, key: actionKey }).strict();

  router.get("/me", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const id = actor.user.id;
    await expireD1BondRequests(db, new Date(), id);
    const now = new Date();
    const [bonds, requests, user] = await Promise.all([
      db.prepare(`${bondSelect} JOIN bond_users AS mine ON mine.bonds_id = b.source_id AND mine.value = ?
        ORDER BY b.status DESC, COALESCE(b.ended_at, b.activated_at) DESC`).bind(id).all<BondRow>(),
      db.prepare(`SELECT * FROM bond_requests WHERE status = 'PENDING' AND expires_at > ?
        AND (sender_id = ? OR recipient_id = ?) ORDER BY created_at DESC LIMIT 100`)
        .bind(now.toISOString(), id, id).all<BondRequestRow>(),
      db.prepare(`SELECT bond_invitations, bond_notifications, wallet_balance, age, is_blocked,
        deletion_requested_at, suspended_until FROM users WHERE source_id = ?`).bind(id)
        .first<{ bond_invitations: number; bond_notifications: number; wallet_balance: number; age: number | null;
          is_blocked: number; deletion_requested_at: string | null; suspended_until: string | null }>()
    ]);
    const active = bonds.results.filter(row => row.status === "ACTIVE");
    const ended = bonds.results.filter(row => row.status !== "ACTIVE").slice(0, 25);
    const partners = await readUsers(db, [...active, ...ended].map(row =>
      (JSON.parse(row.users_json) as string[]).find(value => value !== id) ?? ""));
    const requestPartners = await readUsers(db, requests.results.map(row =>
      row.sender_id === id ? row.recipient_id : row.sender_id));
    const display = (row: BondRow) => {
      const bond = viewBond(row, now);
      const partnerId = bond.users.find(value => value !== id) ?? "";
      return { ...describeBond(bond), partner: partners.has(partnerId) ? bondPerson(partners.get(partnerId)!.person_json) : null,
        slot: bond.slots[bond.users.indexOf(id)] ?? null };
    };
    const present = (row: BondRequestRow) => {
      const incoming = row.recipient_id === id;
      const partnerId = incoming ? row.sender_id : row.recipient_id;
      return { id: row.source_id, kind: row.kind, typeChange: row.bond_id != null, incoming, slot: row.slot,
        message: row.message, expiresAt: row.expires_at, giftName: row.gift_name, giftIcon: row.gift_icon,
        price: row.price, version: row.version,
        partner: requestPartners.has(partnerId) ? bondPerson(requestPartners.get(partnerId)!.person_json) : null };
    };
    sendOk(res, {
      capacity: capacity(), freeInvitations: bondConfigValues.freeInvitations,
      invitationHours: bondConfigValues.invitationHours, levels: bondLevels, balance: user?.wallet_balance ?? 0,
      allowsRequests: user?.bond_invitations !== 0, pushEnabled: user?.bond_notifications !== 0,
      eligible: memberAvailable(user as UserRow | undefined, now),
      kinds: Object.entries(bondKinds).map(([key, value]) => ({ id: key, ...value })),
      active: active.filter(row => {
        const partnerId = (JSON.parse(row.users_json) as string[]).find(value => value !== id) ?? "";
        return memberAvailable(partners.get(partnerId), now);
      }).map(display),
      ended: ended.map(display), requests: requests.results.map(present)
    });
  }));

  router.get("/gift-catalog", asyncHandler(async (_req, res) => {
    await ensureD1BondCatalog(db);
    const { results } = await db.prepare(`SELECT source_id, name, icon, coin_price, bond_purpose, bond_kind,
      bond_points, bond_minimum_days FROM gifts WHERE category = 'bonds' AND is_active = 1
      AND (expires_at IS NULL OR expires_at > ?) ORDER BY coin_price, source_id LIMIT 50`)
      .bind(new Date().toISOString()).all<GiftRow>();
    sendOk(res, { gifts: results.map(gift => ({ id: gift.source_id, name: gift.name, icon: gift.icon,
      price: gift.coin_price, purpose: gift.bond_purpose, kind: gift.bond_kind, points: gift.bond_points,
      minimumDays: gift.bond_minimum_days })) });
  }));

  router.get("/eligible-friends", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const id = actor.user.id;
    const now = new Date();
    const me = (await readUsers(db, [id])).get(id);
    if (!memberAvailable(me, now)) return sendOk(res, { friends: [] });
    const search = String(req.query.q ?? "").trim().slice(0, 60).toLowerCase();
    const { results } = await db.prepare(`SELECT ${userFields}, ${bondPersonJson("u")} AS person_json
      FROM friendships AS f JOIN users AS u ON u.source_id = CASE WHEN f.user_id = ?1 THEN f.friend_id ELSE f.user_id END
      WHERE f.status = 'ACCEPTED' AND (f.user_id = ?1 OR f.friend_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM blocks AS b WHERE (b.blocker_id = ?1 AND b.blocked_user_id = u.source_id)
          OR (b.blocker_id = u.source_id AND b.blocked_user_id = ?1))
        AND NOT EXISTS (SELECT 1 FROM bonds AS bo JOIN bond_users AS bu ON bu.bonds_id = bo.source_id
          WHERE bo.status = 'ACTIVE' AND bu.value IN (?1, u.source_id) AND EXISTS (
            SELECT 1 FROM bond_users AS other WHERE other.bonds_id = bo.source_id AND other.value IN (?1, u.source_id)))
        AND NOT EXISTS (SELECT 1 FROM bond_requests AS r WHERE r.status = 'PENDING' AND r.expires_at > ?2
          AND ((r.sender_id = ?1 AND r.recipient_id = u.source_id) OR (r.sender_id = u.source_id AND r.recipient_id = ?1)))
      ORDER BY f.updated_at DESC, f.source_id DESC LIMIT 500`)
      .bind(id, now.toISOString()).all<UserRow>();
    const eligible = results.filter(row => memberAvailable(row, now) && row.bond_invitations !== 0 &&
      (!search || `${row.name} ${row.username ?? ""}`.toLowerCase().includes(search)));
    const open = await usersWithOpenSlots(db, [id, ...eligible.map(row => row.source_id)], now);
    sendOk(res, { friends: open.has(id) ? eligible.filter(row => open.has(row.source_id)).slice(0, 100)
      .map(row => bondPerson(row.person_json)) : [] });
  }));

  router.get("/leaderboards", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const viewer = actor.user.id;
    const category = z.enum(["SUPPORT", "ACTIVITY", "LONGEST"]).catch("ACTIVITY").parse(req.query.category);
    const window = z.enum(rankingWindows).catch("WEEK").parse(req.query.window as RankingWindow);
    const kindFilter = kind.optional().catch(undefined).parse(req.query.kind);
    const scope = z.enum(["GLOBAL", "FRIENDS", "COMMUNITY"]).catch("GLOBAL").parse(req.query.scope);
    const now = new Date();
    const current = rankingPeriod(now, window);
    const finalized = req.query.period === "previous";
    const period = finalized ? rankingPeriod(new Date(current.start.getTime() - 1), window) : current;
    const snapshot = finalized ? await db.prepare(`SELECT e.bond_id, e.score, e.rank FROM bond_ranking_snapshots AS s
      JOIN bond_ranking_entries AS e ON e.bond_ranking_snapshots_id = s.source_id
      WHERE s.period = ? AND s.category = ? ORDER BY e.position`).bind(period.id, category)
      .all<{ bond_id: string; score: number; rank: number }>() : undefined;
    const rankings: RankEntry[] = snapshot?.results ?? await rankD1Bonds(db, category, period, now);
    const network = scope === "GLOBAL" ? undefined : new Set<string>();
    if (scope === "FRIENDS" && network) {
      const { results } = await db.prepare(`SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS id
        FROM friendships AS f WHERE f.status = 'ACCEPTED' AND (f.user_id = ? OR f.friend_id = ?)`)
        .bind(viewer, viewer, viewer).all<{ id: string }>();
      for (const row of results) network.add(row.id);
    } else if (scope === "COMMUNITY" && network) {
      const { results } = await db.prepare(`SELECT member.value AS id FROM clan_members AS member
        WHERE member.clans_id IN (SELECT mine.clans_id FROM clan_members AS mine WHERE mine.value = ? LIMIT 1)`)
        .bind(viewer).all<{ id: string }>();
      for (const row of results) network.add(row.id);
      network.delete(viewer);
    }
    const bonds = await db.prepare(`${bondSelect} WHERE b.source_id IN (SELECT value FROM json_each(?)) AND b.status = 'ACTIVE'`)
      .bind(json(rankings.map(row => row.bond_id))).all<BondRow>();
    const byId = new Map(bonds.results.map(row => [row.source_id, viewBond(row, now)]));
    const participants = await readUsers(db, bonds.results.flatMap(row => JSON.parse(row.users_json) as string[]));
    const entries = [];
    for (const rank of rankings) {
      const bond = byId.get(rank.bond_id);
      if (!bond || (kindFilter && bond.kind !== kindFilter)) continue;
      if (network && !bond.users.some(id => network.has(id))) continue;
      if (bond.users.length !== 2 || bond.users.some(id => {
        const row = participants.get(id);
        return !row || !memberAvailable(row, now) || preferencesFor(bond, id).leaderboard !== true ||
          preferencesFor(bond, id).visibility !== "PUBLIC";
      })) continue;
      if (await blockedPair(db, viewer, bond.users[0]) || await blockedPair(db, viewer, bond.users[1])) continue;
      entries.push({ rank: rank.rank, score: rank.score, kind: bond.kind,
        people: bond.users.map(id => participants.has(id) ? bondPerson(participants.get(id)!.person_json) : null) });
    }
    sendOk(res, { category, window, scope, period: { id: period.id, start: period.start.toISOString(),
      end: period.end.toISOString() }, finalized: !!snapshot, entries });
  }));

  router.get("/profile/:id", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const viewer = actor.user.id;
    const owner = d1UserId(req.params.id);
    const now = new Date();
    const empty = () => sendOk(res, { bonds: [], canInvite: false });
    if (await blockedPair(db, owner, viewer)) return empty();
    const users = await readUsers(db, [owner, viewer]);
    if (!memberAvailable(users.get(owner), now)) return empty();
    const { results } = await db.prepare(`${bondSelect} WHERE b.status = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM bond_users AS bu WHERE bu.bonds_id = b.source_id AND bu.value = ?)
      ORDER BY b.activated_at DESC LIMIT 12`).bind(owner).all<BondRow>();
    const partners = await readUsers(db, results.flatMap(row =>
      (JSON.parse(row.users_json) as string[]).filter(id => id !== owner)));
    const prior = weeklyPeriod(new Date(weeklyPeriod(now).start.getTime() - 1));
    const { results: snapshot } = await db.prepare(`SELECT e.bond_id, e.rank FROM bond_ranking_snapshots AS s
      JOIN bond_ranking_entries AS e ON e.bond_ranking_snapshots_id = s.source_id
      WHERE s.period = ? AND s.category = 'ACTIVITY'`).bind(prior.id)
      .all<{ bond_id: string; rank: number }>();
    const ranks = new Map(snapshot.map(row => [row.bond_id, row.rank]));
    const cards = [];
    for (const row of results) {
      const bond = viewBond(row, now);
      const other = bond.users.find(id => id !== owner) ?? "";
      if (!memberAvailable(partners.get(other), now)) continue;
      if (await blockedPair(db, viewer, other) || await blockedPair(db, owner, other)) continue;
      const settings = bond.users.map(id => preferencesFor(bond, id));
      if (viewer !== owner && viewer !== other) {
        if (settings.some(value => value.visibility === "PRIVATE")) continue;
        if (settings.some(value => value.visibility === "FRIENDS")) {
          const { results: friendships } = await db.prepare(`SELECT f.userId, f.friendId FROM (
            SELECT user_id AS userId, friend_id AS friendId FROM friendships WHERE status = 'ACCEPTED'
              AND ((user_id = ?1 AND friend_id IN (?2, ?3)) OR (friend_id = ?1 AND user_id IN (?2, ?3)))
            UNION SELECT user_id, friend_id FROM friendships WHERE status = 'ACCEPTED'
              AND ((user_id IN (?2, ?3) AND friend_id = ?1) OR (friend_id IN (?2, ?3) AND user_id = ?1))) AS f`)
            .bind(viewer, owner, other).all<{ userId: string; friendId: string }>();
          const connected = (target: string) => friendships.some(f => [f.userId, f.friendId].includes(target));
          if (!connected(owner) || !connected(other)) continue;
        }
      }
      const rank = ranks.get(bond.id) ?? 0;
      const showRank = rank > 0 && rank <= 10 &&
        settings.every(value => value.showRanking && value.leaderboard && value.visibility === "PUBLIC");
      cards.push({ id: bond.id, kind: bond.kind, kindName: bond.kindName,
        partner: partners.has(other) ? bondPerson(partners.get(other)!.person_json) : null,
        ...(settings.every(value => value.showDuration) || viewer === owner ? { days: bond.days } : {}),
        ...(settings.every(value => value.showLevel) || viewer === owner ? { level: bond.level } : {}),
        showBadge: settings.every(value => value.showBadge), ...(showRank ? { weeklyRank: rank } : {}) });
    }
    const pair = pairKey(owner, viewer);
    const mayInvite = viewer !== owner && memberAvailable(users.get(viewer), now) &&
      users.get(owner)?.bond_invitations !== 0 && !results.some(row => row.pair_key === pair) &&
      !(await db.prepare(`SELECT 1 FROM bond_requests WHERE pair_key = ? AND status = 'PENDING' AND expires_at > ? LIMIT 1`)
        .bind(pair, now.toISOString()).first()) &&
      Boolean(await db.prepare(`SELECT 1 FROM friendships WHERE status = 'ACCEPTED' AND
        ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) LIMIT 1`)
        .bind(owner, viewer, viewer, owner).first());
    const open = await usersWithOpenSlots(db, [owner, viewer], now);
    sendOk(res, { bonds: cards, canInvite: mayInvite && open.has(owner) && open.has(viewer) });
  }));

  router.put("/invitation-settings", validateBody(invitationSettings), asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const updates: string[] = [];
    const values: SqlValue[] = [];
    if (req.body.enabled !== undefined) { updates.push("bond_invitations = ?"); values.push(Number(req.body.enabled)); }
    if (req.body.push !== undefined) { updates.push("bond_notifications = ?"); values.push(Number(req.body.push)); }
    await db.prepare(`UPDATE users SET ${updates.join(", ")}, bond_version = bond_version + 1,
      updated_at = ? WHERE source_id = ?`).bind(...values, new Date().toISOString(), actor.user.id).run();
    sendOk(res, { updated: true });
  }));

  router.post("/invitations", validateBody(inviteSchema), asyncHandler(async (req, res) => {
    await ensureD1BondCatalog(db);
    sendOk(res, await sendRequest(db, res.locals.actor, req.body), 201);
  }));

  for (const [route, action] of [["accept", "ACCEPTED"], ["decline", "DECLINED"], ["cancel", "CANCELLED"]] as const) {
    router.post(`/invitations/:id/${route}`, asyncHandler(async (req, res) =>
      sendOk(res, await resolveRequest(db, res.locals.actor, req.params.id, action))));
  }

  router.get("/:id", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const bond = await readBond(db, d1UserId(req.params.id), actor.user.id);
    const users = await readUsers(db, bond.users);
    const partner = bond.users.find(id => id !== actor.user.id) ?? "";
    const { results } = await db.prepare(`SELECT kind, points, created_at FROM bond_points WHERE bond_id = ?
      AND kind <> 'CHECK_IN' ORDER BY created_at DESC LIMIT 20`).bind(bond.id).all<{ kind: string; points: number; created_at: string | null }>();
    sendOk(res, { ...describeBond(bond), partner: users.has(partner) ? bondPerson(users.get(partner)!.person_json) : null,
      self: users.has(actor.user.id) ? bondPerson(users.get(actor.user.id)!.person_json) : null,
      preferences: preferencesFor(bond, actor.user.id), activity: results.map(row => ({ ...row, createdAt: row.created_at })) });
  }));

  router.patch("/:id/preferences", validateBody(preferencesSchema), asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    for (let attempt = 0; attempt < 4; attempt++) {
      const bond = await readActiveBond(db, d1UserId(req.params.id), actor.user.id);
      const settings = { ...preferencesFor(bond, actor.user.id), ...req.body };
      const time = new Date().toISOString();
      const [claimed, written] = await db.batch([
        db.prepare(`UPDATE bonds SET version = version + 1, updated_at = ? WHERE source_id = ?
          AND status = 'ACTIVE' AND version = ?`).bind(time, bond.id, bond.version),
        db.prepare(`INSERT INTO bond_preferences (source_id, key, value_json, bonds_id, position)
          VALUES (?, ?, ?, ?, 0) ON CONFLICT (source_id) DO UPDATE SET value_json = excluded.value_json
          WHERE EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND version = ?)`)
          .bind(`${bond.id}:preferences:${actor.user.id}`, actor.user.id, json(settings), bond.id, bond.id, bond.version + 1)
      ]);
      if (claimed.meta.changes && written.meta.changes) return sendOk(res, { settings });
    }
    throw new HttpError(409, "Bond preferences changed. Please try again.", ErrorCode.CONFLICT);
  }));

  router.post("/:id/check-in", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    for (let attempt = 0; attempt < 4; attempt++) {
      const bond = await readActiveBond(db, d1UserId(req.params.id), actor.user.id);
      const partner = bond.users.find(id => id !== actor.user.id);
      if (!partner) throw new HttpError(409, "This bond has ended", ErrorCode.CONFLICT);
      const now = new Date();
      const time = now.toISOString();
      const day = time.slice(0, 10);
      const checkInKey = `check-in:${day}:${actor.user.id}`;
      const checkInId = bondPointId(bond.id, checkInKey);
      if (await db.prepare("SELECT 1 FROM bond_points WHERE source_id = ?").bind(checkInId).first()) {
        return sendOk(res, { checkedIn: true });
      }
      await eligiblePair(db, actor.user.id, partner, now, false, false);
      const reciprocal = await db.prepare("SELECT 1 FROM bond_points WHERE source_id = ?")
        .bind(bondPointId(bond.id, `check-in:${day}:${partner}`)).first();
      const awarded = reciprocal ? bondConfigValues.dailyCheckInPoints : 0;
      const statements: D1PreparedStatementLike[] = [
        pointClaim(db, bond.id, checkInKey, "CHECK_IN", 0, 0, actor.user.id, time)
      ];
      if (reciprocal) {
        statements.push(pointClaim(db, bond.id, `reciprocal:${day}`, "ACTIVITY", awarded, 0, null, time));
      }
      statements.push(...updateBondPoints(db, bond, checkInKey, awarded, time));
      statements.push(bumpVersions(db, actor.user.id, partner, time,
        "EXISTS (SELECT 1 FROM bond_points WHERE source_id = ?)", checkInId));
      const [claimed] = await db.batch(statements);
      if (claimed.meta.changes) return sendOk(res, { checkedIn: true });
    }
    throw new HttpError(409, "Bond changed. Please try again.", ErrorCode.CONFLICT);
  }));

  router.post("/:id/gifts", validateBody(giftInput), asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    await ensureD1BondCatalog(db);
    const now = new Date();
    const bond = await readActiveBond(db, d1UserId(req.params.id), actor.user.id);
    const partner = bond.users.find(id => id !== actor.user.id);
    if (!partner) throw new HttpError(409, "This bond has ended", ErrorCode.CONFLICT);
    await eligiblePair(db, actor.user.id, partner, now, false, false);
    const gift = await readGift(db, req.body.giftId, ["PROGRESSION", "ANNIVERSARY", "COSMETIC"], undefined, now);
    if (!gift || (gift.bond_kind && gift.bond_kind !== bond.kind) || gift.bond_minimum_days > bond.days) {
      throw new HttpError(409, "This gift is unavailable for this bond", ErrorCode.CONFLICT);
    }
    const idempotencyKey = `bond:gift:progress:${bond.id}:${req.body.key}`;
    const existing = await db.prepare(`SELECT source_id, gift_id, json_extract(metadata, '$.bondId') AS bond_id
      FROM gift_transactions WHERE sender_id = ? AND json_extract(metadata, '$.idempotencyKey') = ? LIMIT 1`)
      .bind(actor.user.id, idempotencyKey).first<{ source_id: string; gift_id: string; bond_id: string }>();
    if (existing) {
      if (existing.gift_id !== gift.source_id || existing.bond_id !== bond.id) {
        throw new HttpError(409, "This gift key was already used", ErrorCode.CONFLICT);
      }
      return sendOk(res, { sent: true });
    }
    const [senderRow, recipientRow] = await Promise.all([
      (await readUsers(db, [actor.user.id])).get(actor.user.id),
      (await readUsers(db, [partner])).get(partner)
    ]);
    if (!senderRow || !recipientRow) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const guard = `EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND status = 'ACTIVE' AND version = ?)`;
    const guardValues: SqlValue[] = [bond.id, bond.version];
    const settled = await settleGift(db, actor, {
      bond, sender: actor.user.id, recipient: partner, gift, amount: gift.coin_price, points: gift.bond_points,
      key: `progress:${bond.id}:${req.body.key}`, held: false, senderRow, recipientRow,
      startOfDay: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString(),
      guard, guardValues
    });
    const [claimed] = await db.batch(settled.statements);
    if (!claimed.meta.changes) throw new HttpError(409, "This gift key was already used", ErrorCode.CONFLICT);
    sendOk(res, { sent: true });
  }));

  router.post("/:id/type-change", validateBody(typeChange), asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const bond = await readBond(db, d1UserId(req.params.id), actor.user.id);
    const partner = bond.users.find(id => id !== actor.user.id);
    if (!partner) throw new HttpError(404, "Bond not found", ErrorCode.NOT_FOUND);
    sendOk(res, await sendRequest(db, actor, {
      recipient: partner, kind: req.body.kind, key: req.body.key, bondId: bond.id
    }), 201);
  }));

  router.post("/:id/end", asyncHandler(async (req, res) => {
    const actor: Actor = res.locals.actor;
    const bond = await readBond(db, d1UserId(req.params.id), actor.user.id);
    if (bond.status === "ACTIVE") {
      await terminatePair(db, bond.pairKey, actor.user.id, "ENDED", bond.id);
    }
    sendOk(res, { ended: true });
  }));

  return router;
}

export async function runD1BondMaintenance(db: D1Database, now = new Date()) {
  await expireD1BondRequests(db, now);
  const time = now.toISOString();
  const dueRewards = await db.prepare(`SELECT source_id, user_id, item_id FROM bond_rewards
    WHERE expired_at IS NULL AND expires_at <= ? ORDER BY expires_at LIMIT 25`).bind(time).all<{
      source_id: string; user_id: string; item_id: string;
    }>();
  for (const reward of dueRewards.results) {
    await db.batch([
      db.prepare(`UPDATE bond_rewards SET expired_at = ? WHERE source_id = ? AND expired_at IS NULL`)
        .bind(time, reward.source_id),
      db.prepare(`DELETE FROM user_owned_cosmetics WHERE users_id = ? AND value = ? AND EXISTS (
        SELECT 1 FROM cosmetics AS c WHERE c.source_id = ? AND c.reward_only = 1) AND NOT EXISTS (
        SELECT 1 FROM bond_rewards AS r WHERE r.user_id = ? AND r.item_id = ? AND r.expired_at IS NULL
          AND (r.expires_at IS NULL OR r.expires_at > ?))`)
        .bind(reward.user_id, reward.item_id, reward.item_id, reward.user_id, reward.item_id, time),
      db.prepare(`UPDATE users SET active_cosmetics_avatar_frame = NULL WHERE source_id = ?
        AND active_cosmetics_avatar_frame = ? AND EXISTS (
          SELECT 1 FROM cosmetics AS c WHERE c.source_id = ? AND c.reward_only = 1) AND NOT EXISTS (
          SELECT 1 FROM bond_rewards AS r WHERE r.user_id = ? AND r.item_id = ? AND r.expired_at IS NULL
            AND (r.expires_at IS NULL OR r.expires_at > ?))`)
        .bind(reward.user_id, reward.item_id, reward.item_id, reward.user_id, reward.item_id, time)
    ]);
  }
  if (!bondEnabled()) return;
  await ensureD1BondCatalog(db);
  const dueBonds = await db.prepare(`SELECT source_id FROM bonds WHERE status = 'ACTIVE'
    AND next_milestone_at <= ? ORDER BY next_milestone_at LIMIT 100`).bind(time).all<{ source_id: string }>();
  for (const item of dueBonds.results) {
    const row = await db.prepare(`${bondSelect} WHERE b.source_id = ? AND b.status = 'ACTIVE'
      AND b.next_milestone_at <= ?`).bind(item.source_id, time).first<BondRow>();
    if (!row) continue;
    const bond = viewBond(row, now);
    const reached = milestones.filter(day => day <= bond.days && !bond.milestoneDays.includes(day));
    const upcoming = milestones.find(day => day > bond.days);
    const next = upcoming ? new Date(new Date(bond.activatedAt).getTime() + upcoming * dayMs).toISOString() : null;
    const points = reached.length * bondConfigValues.milestonePoints;
    const statements: D1PreparedStatementLike[] = [
      db.prepare(`UPDATE bonds SET points = points + ?, version = version + 1, next_milestone_at = ?, updated_at = ?
        WHERE source_id = ? AND status = 'ACTIVE' AND version = ?`)
        .bind(points, next, time, bond.id, bond.version)
    ];
    for (const day of reached) {
      statements.push(pointClaim(db, bond.id, `milestone:${day}`, "MILESTONE", bondConfigValues.milestonePoints, 0, null, time));
      statements.push(db.prepare(`INSERT INTO bond_milestones (source_id, day, bonds_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM bond_milestones WHERE bonds_id = ?), 0)
        WHERE NOT EXISTS (SELECT 1 FROM bond_milestones WHERE bonds_id = ? AND day = ?)
          AND EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND version = ?)`)
        .bind(`${bond.id}:milestone:${day}`, day, bond.id, bond.id, bond.id, day, bond.id, bond.version));
    }
    if (reached.length) {
      if (reached.some(day => day >= 7)) {
        for (const userId of bond.users) {
          statements.push(...grantD1Reward(db, bond.id, userId, "milestone:7", bondRewardItems.milestone, time, null));
          statements.push(bumpVersions(db, userId, userId, time,
            "EXISTS (SELECT 1 FROM bond_rewards WHERE bond_id = ? AND user_id = ? AND key = ?)",
            bond.id, userId, "milestone:7"));
        }
      }
      const before = bondLevel(bond.points).level;
      const after = bondLevel(bond.points + points).level;
      if (after > before) {
        for (const userId of bond.users) {
          statements.push(notification(db, userId, { kind: "LEVEL_UP", bondId: bond.id },
            "Your bond reached a new level", `Your shared bond is now level ${after}.`, time,
            "EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND version = ?)", bond.id, bond.version + 1));
        }
      }
      for (const userId of bond.users) {
        if (preferencesFor(bond, userId).reminders) {
          statements.push(notification(db, userId, { kind: "MILESTONE", bondId: bond.id },
            "Bond milestone reached", "Open My Bonds to see what you unlocked.", time,
            "EXISTS (SELECT 1 FROM bonds WHERE source_id = ? AND version = ?)", bond.id, bond.version + 1));
        }
      }
    }
    await db.batch(statements);
  }
  await finalizeD1BondPeriods(db, now);
  const dueReminders = await db.prepare(`SELECT source_id FROM bonds WHERE status = 'ACTIVE'
    AND (anniversary_reminder_at <= ? OR anniversary_reminder_at IS NULL) ORDER BY anniversary_reminder_at LIMIT 100`)
    .bind(time).all<{ source_id: string }>();
  for (const item of dueReminders.results) {
    const row = await db.prepare(`${bondSelect} WHERE b.source_id = ? AND b.status = 'ACTIVE'`)
      .bind(item.source_id).first<BondRow>();
    if (!row) continue;
    const bond = viewBond(row, now);
    const anniversary = nextAnniversary(new Date(bond.activatedAt), now);
    const remind = anniversary.getTime() - now.getTime() <= anniversaryLeadMs;
    const next = remind ? nextAnniversary(new Date(bond.activatedAt), anniversary) : anniversary;
    const statements = [db.prepare(`UPDATE bonds SET anniversary_reminder_at = ?, updated_at = ?
      WHERE source_id = ? AND status = 'ACTIVE'`).bind(new Date(next.getTime() - anniversaryLeadMs).toISOString(), time, bond.id)];
    if (remind) {
      for (const userId of bond.users) {
        if (preferencesFor(bond, userId).reminders) {
          statements.push(notification(db, userId, { kind: "ANNIVERSARY_REMINDER", bondId: bond.id },
            "A bond anniversary is coming up", "See your upcoming anniversary in My Bonds.", time));
        }
      }
    }
    await db.batch(statements);
  }
}
