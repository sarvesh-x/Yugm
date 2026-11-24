import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { reactionSchema } from "@yugm/shared";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import {
  canAssignRole, canInviteMembers, canManageClan, canModerateChat, canRemoveMember, CLAN_INVITE_LIFETIME_MS,
  clanMemberIdSchema, clanMemberRoleSchema, clanMessageReportSchema, clanMessageSchema, clanSchema, clanUpdateSchema, slugifyClan
} from "../services/clanPolicy.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { ACTIVE_COSMETIC_KEYS, AVATAR_PART_KEYS } from "./authProfileFields.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { person, personJson } from "./d1People.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

interface ClanRow {
  source_id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar: string | null;
  privacy: "PUBLIC" | "PRIVATE";
  family_label: string;
  owner_id: string;
  member_count: number;
  is_member: number;
  created_at: string | null;
}
type ClanMemberRow = Record<string, string | number | null> & { source_id: string; role: string };

const noMembership = "NOT EXISTS (SELECT 1 FROM clan_members WHERE value = u.source_id)";
const memberInClan = "EXISTS (SELECT 1 FROM clan_members WHERE clans_id = c.source_id AND value = u.source_id)";
const canInviteInClan = `${memberInClan} AND (c.owner_id = u.source_id OR EXISTS (
  SELECT 1 FROM clan_member_roles WHERE clans_id = c.source_id AND user_id = u.source_id AND role IN ('CO_LEADER', 'OFFICER')))`;
const readClan = `SELECT c.*, EXISTS (SELECT 1 FROM clan_members WHERE value = ?1 AND clans_id = c.source_id) AS is_member FROM clans AS c`;
const avatarFields = AVATAR_PART_KEYS.map(key => [key, `avatar_parts_${key}`] as const);
const cosmeticFields = ACTIVE_COSMETIC_KEYS.map(key => [key, `active_cosmetics_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`] as const);
const clanClaims = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";

function clanRole(member: string) {
  return `CASE WHEN c.owner_id = ${member} THEN 'LEADER' ELSE COALESCE((
    SELECT CASE WHEN role IN ('CO_LEADER', 'OFFICER') THEN role ELSE 'MEMBER' END
    FROM clan_member_roles WHERE clans_id = c.source_id AND user_id = ${member} ORDER BY position, source_id LIMIT 1
  ), 'MEMBER') END`;
}

const unchangedMemberRoles = `${clanRole("u.source_id")} = ? AND EXISTS (
  SELECT 1 FROM clan_members AS m WHERE m.clans_id = c.source_id AND m.value = ? AND ${clanRole("m.value")} = ?)`;

function identifier(id: string, entity = "clan") {
  if (!isValidObjectId(id)) throw new HttpError(400, `Invalid ${entity} ID`, ErrorCode.VALIDATION);
  return id.toLowerCase();
}

function presentClan(row: ClanRow, viewer: string, members: ClanMemberRow[] = []) {
  const isOwner = row.owner_id === viewer;
  const memberRoles = members.map(member => ({ userId: member.source_id, role: member.role }));
  const myRole = memberRoles.find(member => member.userId === viewer)?.role ?? null;
  const fields = (member: ClanMemberRow, columns: ReadonlyArray<readonly [string, string]>) =>
    Object.fromEntries(columns.filter(([, column]) => member[column] != null).map(([key, column]) => [key, member[column]]));
  return {
    id: row.source_id, _id: row.source_id, name: row.name, slug: row.slug, description: row.description ?? undefined,
    avatar: row.avatar ?? undefined, privacy: row.privacy, familyLabel: row.family_label, ownerId: row.owner_id,
    memberCount: row.member_count, memberRoles, myRole, canManage: canManageClan(myRole),
    canModerate: canModerateChat(myRole), canInvite: canInviteMembers(myRole), isMember: Boolean(row.is_member),
    isOwner, createdAt: row.created_at ?? undefined,
    members: members.map(member => ({
      _id: member.source_id, name: member.name, username: member.username, avatar: member.avatar ?? undefined,
      avatarType: member.avatar_type ?? undefined, avatarParts: fields(member, avatarFields),
      activeCosmetics: fields(member, cosmeticFields), city: member.city ?? undefined,
      xp: member.xp, level: member.level, levelTitle: member.level_title, vipTier: member.vip_tier ?? undefined,
      vipExpiresAt: member.vip_expires_at ?? undefined, isOnline: false
    }))
  };
}

async function readClanDetails(db: D1Database, clanId: string | null, viewer: string) {
  const selectedClan = "COALESCE(?2, (SELECT clans_id FROM clan_members WHERE value = ?1 LIMIT 1))";
  const [clan, members] = await db.batch([
    db.prepare(`${readClan} WHERE c.source_id = ${selectedClan}`).bind(viewer, clanId),
    db.prepare(`SELECT u.source_id, u.name, u.username, u.avatar, u.avatar_type, u.city, u.xp, u.level, u.level_title,
      u.vip_tier, u.vip_expires_at, ${[...avatarFields, ...cosmeticFields].map(([, col]) => `u.${col}`).join(", ")},
      ${clanRole("u.source_id")} AS role
      FROM clan_members AS m JOIN clans AS c ON c.source_id = m.clans_id JOIN users AS u ON u.source_id = m.value
      WHERE c.source_id = ${selectedClan} ORDER BY m.position`).bind(viewer, clanId)
  ]);
  const row = clan.results[0] as ClanRow | undefined;
  if (!row || (row.privacy === "PRIVATE" && !row.is_member)) return null;
  return presentClan(row, viewer, members.results as ClanMemberRow[]);
}

async function clanDetails(db: D1Database, clanId: string, viewer: string) {
  const clan = await readClanDetails(db, clanId, viewer);
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  return clan;
}

function membershipEffects(db: D1Database, clanId: string, userId: string, membershipId: string, role: "LEADER" | "MEMBER", time: string) {
  const claimed = "EXISTS (SELECT 1 FROM clan_members WHERE source_id = ?)";
  return [
    db.prepare(`INSERT INTO clan_member_roles (source_id, user_id, role, clans_id, position)
      SELECT ?, ?, ?, ?, position FROM clan_members WHERE source_id = ?`)
      .bind(`${membershipId}:role`, userId, role, clanId, membershipId),
    db.prepare(`UPDATE users SET clan_id = ?, updated_at = ? WHERE source_id = ? AND ${claimed}`)
      .bind(clanId, time, userId, membershipId),
    db.prepare(`UPDATE user_auth_profile SET null_fields = (
      SELECT json_group_array(value) FROM json_each(null_fields) WHERE value <> 'clanId')
      WHERE source_id = ? AND ${claimed}`).bind(userId, membershipId),
    db.prepare(`UPDATE clans SET member_count = (SELECT COUNT(*) FROM clan_members WHERE clans_id = ?), updated_at = ?
      WHERE source_id = ? AND ${claimed}`).bind(clanId, time, clanId, membershipId)
  ];
}

function claimMembershipMutation(db: D1Database, claims: AccessClaims, time: string, token: string, clanId: string, condition: string, ...values: string[]) {
  return db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, edit_token)
    SELECT u.source_id, '[]', ? FROM users AS u JOIN clans AS c ON c.source_id = ?
    WHERE ${d1LiveUserFilter} AND ${memberInClan} AND (${condition})
    ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
    .bind(token, clanId, ...bindD1LiveUser(claims, time), ...values);
}

function deleteClanRecords(db: D1Database, clanId: string, actorId: string, token: string, onlyEmpty = false) {
  const guard = onlyEmpty ? `${clanClaims} AND NOT EXISTS (SELECT 1 FROM clan_members WHERE clans_id = ?)` : clanClaims;
  const args = onlyEmpty ? [actorId, token, clanId] : [actorId, token];
  return [
    db.prepare(`DELETE FROM clan_message_reactions WHERE clan_messages_id IN (SELECT source_id FROM clan_messages WHERE clan_id = ?)
      AND ${guard}`).bind(clanId, ...args),
    db.prepare(`DELETE FROM clan_invites WHERE clan_id = ? AND ${guard}`).bind(clanId, ...args),
    db.prepare(`DELETE FROM clan_messages WHERE clan_id = ? AND ${guard}`).bind(clanId, ...args),
    db.prepare(`DELETE FROM clan_member_roles WHERE clans_id = ? AND ${guard}`).bind(clanId, ...args),
    db.prepare(`DELETE FROM clan_members WHERE clans_id = ? AND ${guard}`).bind(clanId, ...args),
    db.prepare(`UPDATE users SET clan_id = NULL WHERE clan_id = ? AND ${guard}`).bind(clanId, ...args),
    db.prepare(`UPDATE mini_game_challenges SET clan_id = NULL WHERE clan_id = ? AND ${guard}`).bind(clanId, ...args),
    db.prepare(`DELETE FROM clans WHERE source_id = ? AND ${guard}`).bind(clanId, ...args)
  ];
}

function getMemberRoles(clan: Awaited<ReturnType<typeof clanDetails>>, target: string) {
  if (!clan.myRole) throw new HttpError(403, "Join this clan to continue", ErrorCode.FORBIDDEN);
  const targetRole = clan.memberRoles.find(member => member.userId === target)?.role;
  if (!targetRole) throw new HttpError(404, "This user is not a clan member", ErrorCode.NOT_FOUND);
  return { actorRole: clan.myRole, targetRole };
}

interface ClanMessageRow {
  source_id: string; clan_id: string; sender_id: string; sender_json: string; message: string;
  created_at: string | null; updated_at: string | null; reactions_json: string;
}

const readClanMessage = `SELECT m.*, ${personJson("sender")} AS sender_json,
  (SELECT json_group_array(json_object('userId', user_id, 'type', type, 'createdAt', created_at))
    FROM (SELECT user_id, type, created_at FROM clan_message_reactions WHERE clan_messages_id = m.source_id ORDER BY position, source_id)
  ) AS reactions_json FROM clan_messages AS m JOIN users AS sender ON sender.source_id = m.sender_id`;
const messageInClan = "EXISTS (SELECT 1 FROM clan_messages WHERE clan_id = c.source_id AND source_id = ?)";
const chatModerators = `${clanRole("u.source_id")} IN ('LEADER', 'CO_LEADER', 'OFFICER')`;

function presentClanMessage(row: ClanMessageRow) {
  return {
    _id: row.source_id, clanId: row.clan_id, senderId: person(row.sender_json), message: row.message,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined, reactions: JSON.parse(row.reactions_json)
  };
}

async function requireClanChatMember(db: D1Database, clanId: string, actor: string) {
  const membership = await db.prepare(`SELECT u.muted_until, ${memberInClan} AS member, ${clanRole("u.source_id")} AS role
    FROM clans AS c JOIN users AS u ON u.source_id = ? WHERE c.source_id = ?`).bind(actor, clanId)
    .first<{ muted_until: string | null; member: number; role: string }>();
  if (!membership) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  if (!membership.member) throw new HttpError(403, "Join this clan to chat", ErrorCode.FORBIDDEN);
  return membership;
}

async function requireClanMessage(db: D1Database, clanId: string, messageId: string) {
  const message = await db.prepare("SELECT sender_id FROM clan_messages WHERE clan_id = ? AND source_id = ?")
    .bind(clanId, messageId).first<{ sender_id: string }>();
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  return message;
}

function mountClanChat(router: ReturnType<typeof Router>, db: D1Database, limits: { chat?: D1UserRateLimit; report?: D1UserRateLimit }) {
  router.get("/:id/messages", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    await requireClanChatMember(db, clanId, claims.sub);
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 80, 1), 120));
    const cursor = Date.parse(String(req.query.before ?? ""));
    const before = Number.isNaN(cursor) ? null : new Date(cursor).toISOString();
    const { results } = await db.prepare(`${readClanMessage} WHERE m.clan_id = ? AND (? IS NULL OR m.created_at < ?)
      AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}
        AND EXISTS (SELECT 1 FROM clan_members WHERE clans_id = m.clan_id AND value = u.source_id))
      ORDER BY m.created_at DESC, m.source_id DESC LIMIT ?`)
      .bind(clanId, before, before, ...bindD1LiveUser(claims, new Date().toISOString()), limit).all<ClanMessageRow>();
    sendOk(res, { messages: results.reverse().map(presentClanMessage), hasMore: results.length === limit });
  }));

  router.post("/:id/messages", validateBody(clanMessageSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    await enforceD1UserRateLimit(limits.chat, claims.sub, res, 10);
    const time = new Date().toISOString();
    const member = await requireClanChatMember(db, clanId, claims.sub);
    if (member.muted_until && member.muted_until > time) throw new HttpError(403, `Account muted until ${member.muted_until}`, ErrorCode.FORBIDDEN);
    const message = sanitizeText(req.body.message).trim();
    if (!message) throw new HttpError(400, "Message cannot be empty", ErrorCode.VALIDATION);
    const id = randomBytes(12).toString("hex");
    const [sent, , committed] = await db.batch<ClanMessageRow>([
      db.prepare(`INSERT INTO clan_messages (source_id, clan_id, sender_id, message, created_at, updated_at)
        SELECT ?, c.source_id, u.source_id, ?, ?, ? FROM users AS u JOIN clans AS c ON c.source_id = ?
        WHERE ${d1LiveUserFilter} AND ${memberInClan} AND (u.muted_until IS NULL OR u.muted_until <= ?)`)
        .bind(id, message, time, time, clanId, ...bindD1LiveUser(claims, time), time),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT lower(hex(randomblob(12))), member.value, 'MESSAGE', 'New family message', sender.name || ': ' || m.message,
          json_object('clanId', m.clan_id, 'messageId', m.source_id), 0, ?, ?
        FROM clan_messages AS m JOIN users AS sender ON sender.source_id = m.sender_id
        JOIN clan_members AS member ON member.clans_id = m.clan_id
        WHERE m.source_id = ? AND member.value <> m.sender_id ORDER BY member.position LIMIT 50`).bind(time, time, id),
      db.prepare(`${readClanMessage} WHERE m.source_id = ?`).bind(id)
    ]);
    if (!sent.meta.changes || !committed.results[0]) throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { message: presentClanMessage(committed.results[0]) }, 201);
  }));

  router.post("/:id/messages/:messageId/reactions", validateBody(reactionSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const messageId = identifier(req.params.messageId, "message");
    const claims: AccessClaims = res.locals.claims;
    const type: string = req.body.type;
    await enforceD1UserRateLimit(limits.chat, claims.sub, res, 10);
    await requireClanChatMember(db, clanId, claims.sub);
    await requireClanMessage(db, clanId, messageId);
    const time = new Date().toISOString();
    const reactionId = randomBytes(12).toString("hex");
    const args = [claims.sub, reactionId];
    const [changed, , , , committed] = await db.batch<ClanMessageRow>([
      claimMembershipMutation(db, claims, time, reactionId, clanId, messageInClan, messageId),
      db.prepare(`INSERT INTO clan_message_reactions (source_id, user_id, type, created_at, clan_messages_id, position)
        SELECT ?, ?, ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM clan_message_reactions WHERE clan_messages_id = ?), 0)
        WHERE ${clanClaims} AND NOT EXISTS (SELECT 1 FROM clan_message_reactions WHERE clan_messages_id = ? AND user_id = ? AND type = ?)
        `).bind(reactionId, claims.sub, type, time, messageId, messageId, ...args, messageId, claims.sub, type),
      db.prepare(`DELETE FROM clan_message_reactions WHERE clan_messages_id = ? AND user_id = ? AND source_id <> ? AND ${clanClaims}`)
        .bind(messageId, claims.sub, reactionId, ...args),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, m.sender_id, 'MESSAGE', 'New family reaction', u.name || ' reacted to your family message',
          json_object('clanId', m.clan_id, 'messageId', m.source_id), 0, ?, ?
        FROM clan_message_reactions AS r JOIN clan_messages AS m ON m.source_id = r.clan_messages_id
        JOIN users AS u ON u.source_id = r.user_id WHERE r.source_id = ? AND r.user_id <> m.sender_id`)
        .bind(randomBytes(12).toString("hex"), time, time, reactionId),
      db.prepare(`${readClanMessage} WHERE m.source_id = ? AND ${clanClaims}`).bind(messageId, ...args)
    ]);
    if (!changed.meta.changes || !committed.results[0]) throw new HttpError(409, "Clan message changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { message: presentClanMessage(committed.results[0]) });
  }));

  router.delete("/:id/messages/:messageId", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const messageId = identifier(req.params.messageId, "message");
    const claims: AccessClaims = res.locals.claims;
    const member = await requireClanChatMember(db, clanId, claims.sub);
    const message = await requireClanMessage(db, clanId, messageId);
    if (message.sender_id !== claims.sub && !canModerateChat(member.role)) {
      throw new HttpError(403, "You don't have permission to delete this message", ErrorCode.FORBIDDEN);
    }
    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const args = [claims.sub, token];
    const [claimed] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId, `EXISTS (SELECT 1 FROM clan_messages
        WHERE clan_id = c.source_id AND source_id = ? AND (sender_id = u.source_id OR ${chatModerators}))`, messageId),
      db.prepare(`DELETE FROM clan_message_reactions WHERE clan_messages_id = ? AND ${clanClaims}`).bind(messageId, ...args),
      db.prepare(`DELETE FROM clan_messages WHERE source_id = ? AND clan_id = ? AND ${clanClaims}`).bind(messageId, clanId, ...args)
    ]);
    if (!claimed.meta.changes) throw new HttpError(409, "Clan message changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { deleted: true });
  }));

  router.post("/:id/messages/clean", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const member = await requireClanChatMember(db, clanId, claims.sub);
    if (!canModerateChat(member.role)) throw new HttpError(403, "You don't have permission to clean the chat", ErrorCode.FORBIDDEN);
    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const args = [claims.sub, token];
    const [claimed, , deleted] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId, chatModerators),
      db.prepare(`DELETE FROM clan_message_reactions WHERE clan_messages_id IN (SELECT source_id FROM clan_messages WHERE clan_id = ?)
        AND ${clanClaims}`).bind(clanId, ...args),
      db.prepare(`DELETE FROM clan_messages WHERE clan_id = ? AND ${clanClaims}`).bind(clanId, ...args)
    ]);
    if (!claimed.meta.changes) throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { deletedCount: deleted.meta.changes });
  }));

  router.post("/:id/messages/:messageId/report", validateBody(clanMessageReportSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const messageId = identifier(req.params.messageId, "message");
    const claims: AccessClaims = res.locals.claims;
    await enforceD1UserRateLimit(limits.report, claims.sub, res, 60);
    await requireClanChatMember(db, clanId, claims.sub);
    await requireClanMessage(db, clanId, messageId);
    const time = new Date().toISOString();
    const id = randomBytes(12).toString("hex");
    const { reason, description } = req.body;
    const report = await db.prepare(`INSERT INTO reports (source_id, reporter_id, target_user_id, reason, description, evidence,
      risk_score, auto_flagged, status, created_at, updated_at)
      SELECT ?, u.source_id, m.sender_id, ?, ?, json_object('clanId', c.source_id, 'clanMessageId', m.source_id,
        'message', m.message, 'createdAt', m.created_at), 10, 0, 'PENDING', ?, ?
      FROM clans AS c JOIN clan_messages AS m ON m.clan_id = c.source_id JOIN users AS u ON u.source_id = ?
      WHERE c.source_id = ? AND m.source_id = ? AND ${d1LiveUserFilter} AND ${memberInClan}
      RETURNING target_user_id, evidence`).bind(id, reason, description ?? null, time, time, claims.sub, clanId, messageId,
      ...bindD1LiveUser(claims, time)).first<{ target_user_id: string; evidence: string }>();
    if (!report) throw new HttpError(409, "Clan message changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { report: { _id: id, reporterId: claims.sub, targetUserId: report.target_user_id, reason, description,
      evidence: JSON.parse(report.evidence), riskScore: 10, autoFlagged: false, status: "PENDING", createdAt: time, updatedAt: time } }, 201);
  }));
}

interface InviteRow {
  source_id: string;
  clan_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  clan_json?: string;
  inviter_json?: string;
  invitee_json?: string;
}

function presentInvite(row: InviteRow) {
  return {
    _id: row.source_id, clanId: row.clan_json ? JSON.parse(row.clan_json) : row.clan_id,
    inviterId: row.inviter_json ? JSON.parse(row.inviter_json) : row.inviter_id,
    inviteeId: row.invitee_json ? JSON.parse(row.invitee_json) : row.invitee_id,
    status: row.status, expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function inviteUser(alias: "sender" | "recipient") {
  const field = (name: string) => `${alias}.${name}`;
  return `json_object('_id', ${field("source_id")}, 'name', ${field("name")}, 'username', ${field("username")},
    'avatar', ${field("avatar")}, 'avatarType', ${field("avatar_type")}, 'avatarParts',
    json_object(${avatarFields.map(([key, column]) => `'${key}', ${field(column)}`).join(", ")}))`;
}

export function createD1ClansRouter(db: D1Database, limits: { chat?: D1UserRateLimit; report?: D1UserRateLimit } = {}) {
  const router = Router();
  const readAccess = createD1AccessSessionReader(db, "http");
  router.use(asyncHandler(async (req, res, next) => {
    res.locals.claims = (await requireHttpSession(req.headers.authorization, readAccess)).claims;
    next();
  }));
  mountClanChat(router, db, limits);

  router.get("/", asyncHandler(async (req, res) => {
    const { sub } = res.locals.claims as AccessClaims;
    const query = String(req.query.q ?? "").trim();
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 50, 1), 100));
    const { results } = await db.prepare(`SELECT * FROM (${readClan}) AS clan
      WHERE (privacy = 'PUBLIC' OR is_member = 1)
        AND (?2 = '' OR instr(lower(name), lower(?2)) > 0 OR instr(lower(description), lower(?2)) > 0
          OR instr(lower(slug), lower(?2)) > 0)
      ORDER BY member_count DESC, created_at DESC, source_id LIMIT ?3`).bind(sub, query, limit).all<ClanRow>();
    sendOk(res, { clans: results.map(clan => presentClan(clan, sub)) });
  }));

  router.get("/me", asyncHandler(async (_req, res) => {
    const { sub } = res.locals.claims as AccessClaims;
    sendOk(res, { clan: await readClanDetails(db, null, sub) });
  }));

  router.get("/leaderboard", asyncHandler(async (req, res) => {
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 20, 1), 50));
    const { results } = await db.prepare(`SELECT c.source_id AS _id, c.source_id AS id, c.name, c.slug, c.avatar,
      c.family_label AS familyLabel, c.member_count AS memberCount,
      COALESCE((SELECT SUM(u.xp) FROM users AS u WHERE u.source_id IN (SELECT value FROM clan_members WHERE clans_id = c.source_id)), 0) AS totalXp
      FROM clans AS c WHERE c.privacy = 'PUBLIC' AND c.member_count > 0
      ORDER BY totalXp DESC, memberCount DESC, c.created_at, c.source_id LIMIT ?`).bind(limit).all<Record<string, unknown>>();
    sendOk(res, { clans: results.map((clan, index) => ({ ...clan, rank: index + 1 })) });
  }));

  router.get("/invitations", asyncHandler(async (_req, res) => {
    const { sub } = res.locals.claims as AccessClaims;
    const { results } = await db.prepare(`SELECT i.*, ${inviteUser("sender")} AS inviter_json,
      json_object('_id', c.source_id, 'name', c.name, 'slug', c.slug, 'avatar', c.avatar, 'familyLabel', c.family_label,
        'memberCount', c.member_count, 'privacy', c.privacy) AS clan_json
      FROM clan_invites AS i JOIN clans AS c ON c.source_id = i.clan_id JOIN users AS sender ON sender.source_id = i.inviter_id
      WHERE i.invitee_id = ? AND i.status = 'PENDING' AND i.expires_at > ? ORDER BY i.created_at DESC, i.source_id LIMIT 30`)
      .bind(sub, new Date().toISOString()).all<InviteRow>();
    sendOk(res, { invitations: results.map(presentInvite) });
  }));

  router.get("/:id/invitations", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const { sub } = res.locals.claims as AccessClaims;
    if (!(await clanDetails(db, clanId, sub)).canInvite) {
      throw new HttpError(403, "You don't have permission to view clan invitations", ErrorCode.FORBIDDEN);
    }
    const { results } = await db.prepare(`SELECT i.*, ${inviteUser("sender")} AS inviter_json, ${inviteUser("recipient")} AS invitee_json
      FROM clan_invites AS i JOIN clans AS c ON c.source_id = i.clan_id
      JOIN users AS sender ON sender.source_id = i.inviter_id JOIN users AS recipient ON recipient.source_id = i.invitee_id
      WHERE i.clan_id = ? AND i.status = 'PENDING' AND i.expires_at > ?
        AND EXISTS (SELECT 1 FROM users AS u WHERE u.source_id = ? AND ${canInviteInClan})
      ORDER BY i.created_at DESC, i.source_id LIMIT 50`).bind(clanId, new Date().toISOString(), sub).all<InviteRow>();
    sendOk(res, { invitations: results.map(presentInvite) });
  }));

  router.post("/:id/invitations", validateBody(clanMemberIdSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const inviteeId = identifier(req.body.userId, "member");
    const clan = await clanDetails(db, clanId, claims.sub);
    if (!clan.canInvite) throw new HttpError(403, "You don't have permission to invite members", ErrorCode.FORBIDDEN);
    if (claims.sub === inviteeId) throw new HttpError(400, "You are already in this clan", ErrorCode.VALIDATION);

    const id = randomBytes(12).toString("hex");
    const now = new Date();
    const time = now.toISOString();
    const expiresAt = new Date(now.getTime() + CLAN_INVITE_LIFETIME_MS).toISOString();
    const [, , invitation] = await db.batch<InviteRow>([
      db.prepare(`INSERT INTO clan_invites (source_id, clan_id, inviter_id, invitee_id, status, expires_at, created_at, updated_at)
        SELECT ?, c.source_id, u.source_id, recipient.source_id, 'PENDING', ?, ?, ?
        FROM users AS u JOIN clans AS c ON c.source_id = ? JOIN users AS recipient ON recipient.source_id = ?
        WHERE ${d1LiveUserFilter} AND ${canInviteInClan}
          AND NOT EXISTS (SELECT 1 FROM clan_members WHERE value = recipient.source_id)
          AND NOT EXISTS (SELECT 1 FROM clan_invites WHERE clan_id = c.source_id AND invitee_id = recipient.source_id
            AND status = 'PENDING' AND expires_at > ?)`)
        .bind(id, expiresAt, time, time, clanId, inviteeId, ...bindD1LiveUser(claims, time), time),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, i.invitee_id, 'ROOM_INVITE', 'Clan invitation', u.name || ' invited you to join ' || c.name,
          json_object('clanId', c.source_id, 'clanInviteId', i.source_id), 0, ?, ?
        FROM clan_invites AS i JOIN users AS u ON u.source_id = i.inviter_id JOIN clans AS c ON c.source_id = i.clan_id
        WHERE i.source_id = ?`).bind(randomBytes(12).toString("hex"), time, time, id),
      db.prepare(`SELECT i.* FROM clan_invites AS i JOIN clans AS c ON c.source_id = i.clan_id
        WHERE i.clan_id = ? AND i.invitee_id = ? AND i.status = 'PENDING' AND i.expires_at > ?
        AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND ${canInviteInClan})
        AND NOT EXISTS (SELECT 1 FROM clan_members WHERE value = i.invitee_id)
        ORDER BY i.created_at DESC, i.source_id LIMIT 1`).bind(clanId, inviteeId, time, ...bindD1LiveUser(claims, time))
    ]);
    const row = invitation.results[0];
    if (!row) {
      await requireHttpSession(req.headers.authorization, readAccess);
      const receiver = await db.prepare("SELECT 1 FROM users WHERE source_id = ?").bind(inviteeId).first();
      if (!receiver) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      const current = await db.prepare("SELECT clans_id FROM clan_members WHERE value = ?").bind(inviteeId).first("clans_id");
      if (current) throw new HttpError(409, current === clanId ? "This user is already in your clan" : "This user already belongs to a clan", ErrorCode.CONFLICT);
      throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { invitation: presentInvite(row) }, 201);
  }));

  router.delete("/:id/invitations/:inviteId", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const inviteId = identifier(req.params.inviteId, "invitation");
    const claims: AccessClaims = res.locals.claims;
    if (!(await clanDetails(db, clanId, claims.sub)).canInvite) {
      throw new HttpError(403, "You don't have permission to manage clan invitations", ErrorCode.FORBIDDEN);
    }
    const time = new Date().toISOString();
    const row = await db.prepare(`UPDATE clan_invites AS i SET status = 'CANCELLED', updated_at = ?
      WHERE i.source_id = ? AND i.clan_id = ? AND i.status = 'PENDING' AND EXISTS (
        SELECT 1 FROM users AS u JOIN clans AS c ON c.source_id = i.clan_id WHERE ${d1LiveUserFilter} AND ${canInviteInClan})
      RETURNING *`).bind(time, inviteId, clanId, ...bindD1LiveUser(claims, time)).first<InviteRow>();
    if (!row) throw new HttpError(404, "Invitation not found", ErrorCode.NOT_FOUND);
    sendOk(res, { invitation: presentInvite(row) });
  }));

  router.post("/invitations/:inviteId/:action(accept|decline)", asyncHandler(async (req, res) => {
    const inviteId = identifier(req.params.inviteId, "invitation");
    const claims: AccessClaims = res.locals.claims;
    const time = new Date().toISOString();
    const valid = "i.invitee_id = ? AND i.source_id = ? AND i.status = 'PENDING' AND i.expires_at > ?";
    const inviteArgs = [claims.sub, inviteId, time];
    if (req.params.action === "decline") {
      const row = await db.prepare(`UPDATE clan_invites AS i SET status = 'DECLINED', updated_at = ? WHERE ${valid}
        AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}) RETURNING *`)
        .bind(time, ...inviteArgs, ...bindD1LiveUser(claims, time)).first<InviteRow>();
      if (!row) throw new HttpError(404, "Invitation not found or expired", ErrorCode.NOT_FOUND);
      return sendOk(res, { invitation: presentInvite(row) });
    }

    const pending = await db.prepare(`SELECT i.clan_id FROM clan_invites AS i WHERE ${valid}`).bind(...inviteArgs).first<string>("clan_id");
    if (!pending) throw new HttpError(404, "Invitation not found or expired", ErrorCode.NOT_FOUND);
    const token = randomBytes(16).toString("hex");
    const memberId = `${token}:member`;
    const args = [claims.sub, token];
    const [accepted, invitation] = await db.batch<InviteRow>([
      db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, edit_token)
        SELECT u.source_id, '[]', ? FROM users AS u JOIN clan_invites AS i ON i.invitee_id = u.source_id
        WHERE ${valid} AND i.clan_id = ? AND ${d1LiveUserFilter}
          AND NOT EXISTS (SELECT 1 FROM clan_members WHERE value = u.source_id AND clans_id <> i.clan_id)
        ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
        .bind(token, ...inviteArgs, pending, ...bindD1LiveUser(claims, time)),
      db.prepare(`UPDATE clan_invites SET status = 'ACCEPTED', updated_at = ?
        WHERE source_id = ? AND ${clanClaims} RETURNING *`).bind(time, inviteId, ...args),
      db.prepare(`INSERT INTO clan_members (source_id, value, clans_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM clan_members WHERE clans_id = ?), 0)
        WHERE ${clanClaims} AND NOT EXISTS (SELECT 1 FROM clan_members WHERE value = ?)`)
        .bind(memberId, claims.sub, pending, pending, ...args, claims.sub),
      ...membershipEffects(db, pending, claims.sub, memberId, "MEMBER", time)
    ]);
    if (!accepted.meta.changes) {
      await requireHttpSession(req.headers.authorization, readAccess);
      const current = await db.prepare(`SELECT 1 FROM clan_invites AS i WHERE ${valid}`).bind(...inviteArgs).first();
      if (!current) throw new HttpError(404, "Invitation not found or expired", ErrorCode.NOT_FOUND);
      throw new HttpError(409, "Leave your current clan before accepting another invitation", ErrorCode.CONFLICT);
    }
    sendOk(res, { invitation: presentInvite(invitation.results[0]), clan: await clanDetails(db, pending, claims.sub) });
  }));

  router.get("/:id([a-fA-F0-9]{24})", asyncHandler(async (req, res) => {
    const { sub } = res.locals.claims as AccessClaims;
    sendOk(res, { clan: await clanDetails(db, identifier(req.params.id), sub) });
  }));

  router.post("/", validateBody(clanSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const id = randomBytes(12).toString("hex");
    const memberId = `${id}:member:${claims.sub}`;
    const name = sanitizeText(req.body.name);
    if (!name) throw new HttpError(400, "Clan name is required", ErrorCode.VALIDATION);
    const baseSlug = slugifyClan(req.body.name);
    const time = new Date().toISOString();
    const [created] = await db.batch([
      db.prepare(`INSERT INTO clans (source_id, owner_id, name, slug, description, avatar, privacy, family_label,
        member_count, created_at, updated_at)
        SELECT ?, u.source_id, ?, CASE WHEN EXISTS (SELECT 1 FROM clans WHERE slug = ?) THEN ? ELSE ? END,
          ?, ?, ?, ?, 1, ?, ? FROM users AS u WHERE ${d1LiveUserFilter} AND ${noMembership}`)
        .bind(id, name, baseSlug, `${baseSlug}-${id.slice(-8)}`, baseSlug,
          req.body.description ? sanitizeText(req.body.description) : null, req.body.avatar ?? null, req.body.privacy,
          sanitizeText(req.body.familyLabel), time, time, ...bindD1LiveUser(claims, time)),
      db.prepare(`INSERT INTO clan_members (source_id, value, clans_id, position)
        SELECT ?, owner_id, source_id, 0 FROM clans WHERE source_id = ?`).bind(memberId, id),
      ...membershipEffects(db, id, claims.sub, memberId, "LEADER", time)
    ]);
    if (!created.meta.changes) {
      await requireHttpSession(req.headers.authorization, readAccess);
      throw new HttpError(400, "Leave your current clan before creating another", ErrorCode.VALIDATION);
    }
    sendOk(res, { clan: await clanDetails(db, id, claims.sub) }, 201);
  }));

  router.post("/:id/join", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const time = new Date().toISOString();
    const memberId = randomBytes(12).toString("hex");
    const [joined] = await db.batch([
      db.prepare(`INSERT INTO clan_members (source_id, value, clans_id, position)
        SELECT ?, u.source_id, c.source_id, COALESCE((SELECT MAX(position) + 1 FROM clan_members WHERE clans_id = c.source_id), 0)
        FROM users AS u JOIN clans AS c ON c.source_id = ? AND c.privacy = 'PUBLIC'
        WHERE ${d1LiveUserFilter} AND ${noMembership}`).bind(memberId, clanId, ...bindD1LiveUser(claims, time)),
      ...membershipEffects(db, clanId, claims.sub, memberId, "MEMBER", time)
    ]);
    if (!joined.meta.changes) {
      await requireHttpSession(req.headers.authorization, readAccess);
      if (await db.prepare("SELECT 1 FROM clan_members WHERE value = ?").bind(claims.sub).first()) {
        throw new HttpError(400, "Leave your current clan before joining another", ErrorCode.VALIDATION);
      }
      const privacy = await db.prepare("SELECT privacy FROM clans WHERE source_id = ?").bind(clanId).first("privacy");
      if (!privacy) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
      if (privacy === "PRIVATE") throw new HttpError(403, "This clan is invite-only", ErrorCode.FORBIDDEN);
      throw new HttpError(409, "Membership changed. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { clan: await clanDetails(db, clanId, claims.sub) });
  }));

  router.patch("/:id", validateBody(clanUpdateSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const clan = await clanDetails(db, clanId, claims.sub);
    if (!clan.canManage) throw new HttpError(403, "You don't have permission to update clan settings", ErrorCode.FORBIDDEN);

    const time = new Date().toISOString();
    const { name, description, avatar, privacy, familyLabel } = req.body;
    const fields = {
      ...(name === undefined ? {} : { name: sanitizeText(name) }),
      ...(description === undefined ? {} : { description: description === null ? null : sanitizeText(description) }),
      ...(avatar === undefined ? {} : { avatar }),
      ...(privacy === undefined ? {} : { privacy }),
      ...(familyLabel === undefined ? {} : { family_label: sanitizeText(familyLabel) }),
      updated_at: time
    };
    if ("name" in fields && !fields.name) throw new HttpError(400, "Clan name is required", ErrorCode.VALIDATION);
    const result = await db.prepare(`UPDATE clans AS c SET ${Object.keys(fields).map(field => `${field} = ?`).join(", ")}
      WHERE c.source_id = ? AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND ${memberInClan}
        AND (c.owner_id = u.source_id OR EXISTS (SELECT 1 FROM clan_member_roles
          WHERE clans_id = c.source_id AND user_id = u.source_id AND role = 'CO_LEADER')))`)
      .bind(...Object.values(fields), clanId, ...bindD1LiveUser(claims, time)).run();
    if (!result.meta.changes) throw new HttpError(409, "Clan settings changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { clan: await clanDetails(db, clanId, claims.sub) });
  }));

  router.post("/:id/transfer-ownership", validateBody(clanMemberIdSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const target = identifier(req.body.userId, "member");
    const clan = await clanDetails(db, clanId, claims.sub);
    if (clan.myRole !== "LEADER") throw new HttpError(403, "Only the clan leader can perform this action", ErrorCode.FORBIDDEN);
    if (!clan.memberRoles.some(member => member.userId === target)) {
      throw new HttpError(400, "Ownership can only be transferred to a clan member", ErrorCode.VALIDATION);
    }
    if (target === claims.sub) return sendOk(res, { clan });

    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const claimArgs = [claims.sub, token];
    const [transferred] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId,
        "c.owner_id = u.source_id AND EXISTS (SELECT 1 FROM clan_members WHERE clans_id = c.source_id AND value = ?)", target),
      db.prepare(`UPDATE clans SET owner_id = ?, updated_at = ? WHERE source_id = ? AND ${clanClaims}`)
        .bind(target, time, clanId, ...claimArgs),
      db.prepare(`DELETE FROM clan_member_roles WHERE clans_id = ? AND user_id IN (?, ?) AND ${clanClaims}`)
        .bind(clanId, claims.sub, target, ...claimArgs),
      db.prepare(`INSERT INTO clan_member_roles (source_id, user_id, role, clans_id, position)
        SELECT ? || ':' || value, value, CASE WHEN value = ? THEN 'LEADER' ELSE 'CO_LEADER' END, clans_id, position
        FROM clan_members WHERE clans_id = ? AND value IN (?, ?) AND ${clanClaims}`)
        .bind(token, target, clanId, claims.sub, target, ...claimArgs)
    ]);
    if (!transferred.meta.changes) throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { clan: await clanDetails(db, clanId, claims.sub) });
  }));

  router.patch("/:id/members/:userId/role", validateBody(clanMemberRoleSchema), asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const target = identifier(req.params.userId, "member");
    const claims: AccessClaims = res.locals.claims;
    const clan = await clanDetails(db, clanId, claims.sub);
    const { actorRole, targetRole } = getMemberRoles(clan, target);
    if (targetRole === "LEADER") throw new HttpError(400, "Transfer ownership to change the leader role", ErrorCode.VALIDATION);
    if (!canAssignRole(actorRole, targetRole, req.body.role)) throw new HttpError(403, "You don't have permission to assign this role", ErrorCode.FORBIDDEN);

    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const args = [claims.sub, token];
    const [changed] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId, unchangedMemberRoles, actorRole, target, targetRole),
      db.prepare(`DELETE FROM clan_member_roles WHERE clans_id = ? AND user_id = ? AND ${clanClaims}`).bind(clanId, target, ...args),
      db.prepare(`INSERT INTO clan_member_roles (source_id, user_id, role, clans_id, position)
        SELECT ?, value, ?, clans_id, position FROM clan_members WHERE clans_id = ? AND value = ? AND ${clanClaims}`)
        .bind(`${token}:role`, req.body.role, clanId, target, ...args),
      db.prepare(`UPDATE clans SET updated_at = ? WHERE source_id = ? AND ${clanClaims}`).bind(time, clanId, ...args)
    ]);
    if (!changed.meta.changes) throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { clan: await clanDetails(db, clanId, claims.sub) });
  }));

  router.delete("/:id/members/:userId", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const target = identifier(req.params.userId, "member");
    const claims: AccessClaims = res.locals.claims;
    const clan = await clanDetails(db, clanId, claims.sub);
    const { actorRole, targetRole } = getMemberRoles(clan, target);
    if (target === claims.sub) throw new HttpError(400, "Use leave to exit your clan", ErrorCode.VALIDATION);
    if (targetRole === "LEADER") throw new HttpError(400, "The clan leader cannot be removed", ErrorCode.VALIDATION);
    if (!canRemoveMember(actorRole, targetRole)) throw new HttpError(403, "You don't have permission to remove this member", ErrorCode.FORBIDDEN);

    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const args = [claims.sub, token];
    const [changed] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId, unchangedMemberRoles, actorRole, target, targetRole),
      db.prepare(`UPDATE users SET clan_id = NULL, updated_at = ? WHERE source_id = ? AND clan_id = ? AND ${clanClaims}`)
        .bind(time, target, clanId, ...args),
      db.prepare(`DELETE FROM clan_member_roles WHERE clans_id = ? AND user_id = ? AND ${clanClaims}`).bind(clanId, target, ...args),
      db.prepare(`DELETE FROM clan_members WHERE clans_id = ? AND value = ? AND ${clanClaims}`).bind(clanId, target, ...args),
      db.prepare(`UPDATE clan_invites SET status = 'CANCELLED', updated_at = ?
        WHERE clan_id = ? AND invitee_id = ? AND status = 'PENDING' AND ${clanClaims}`).bind(time, clanId, target, ...args),
      db.prepare(`UPDATE clans SET member_count = (SELECT COUNT(*) FROM clan_members WHERE clans_id = ?), updated_at = ?
        WHERE source_id = ? AND ${clanClaims}`).bind(clanId, time, clanId, ...args)
    ]);
    if (!changed.meta.changes) throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { clan: await clanDetails(db, clanId, claims.sub) });
  }));

  router.delete("/:id", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const clan = await clanDetails(db, clanId, claims.sub);
    if (clan.myRole !== "LEADER") throw new HttpError(403, "Only the clan leader can perform this action", ErrorCode.FORBIDDEN);

    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const [changed] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId, "c.owner_id = u.source_id"),
      ...deleteClanRecords(db, clanId, claims.sub, token)
    ]);
    if (!changed.meta.changes) throw new HttpError(409, "Clan membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { clan: null });
  }));

  router.post("/:id/leave", asyncHandler(async (req, res) => {
    const clanId = identifier(req.params.id);
    const claims: AccessClaims = res.locals.claims;
    const time = new Date().toISOString();
    const token = randomBytes(16).toString("hex");
    const args = [claims.sub, token];
    const [left] = await db.batch([
      claimMembershipMutation(db, claims, time, token, clanId, `c.owner_id <> u.source_id OR NOT EXISTS (
        SELECT 1 FROM clan_members WHERE clans_id = c.source_id AND value <> u.source_id)`),
      db.prepare(`UPDATE users SET clan_id = NULL, updated_at = ? WHERE source_id = ? AND ${clanClaims}`).bind(time, claims.sub, ...args),
      db.prepare(`DELETE FROM clan_member_roles WHERE clans_id = ? AND user_id = ? AND ${clanClaims}`).bind(clanId, claims.sub, ...args),
      db.prepare(`DELETE FROM clan_members WHERE clans_id = ? AND value = ? AND ${clanClaims}`).bind(clanId, claims.sub, ...args),
      db.prepare(`UPDATE clans SET member_count = (SELECT COUNT(*) FROM clan_members WHERE clans_id = ?), updated_at = ?
        WHERE source_id = ? AND ${clanClaims}`).bind(clanId, time, clanId, ...args),
      ...deleteClanRecords(db, clanId, claims.sub, token, true)
    ]);
    if (!left.meta.changes) {
      await requireHttpSession(req.headers.authorization, readAccess);
      const clan = await clanDetails(db, clanId, claims.sub);
      if (!clan.isMember) throw new HttpError(400, "You are not a member of this clan", ErrorCode.VALIDATION);
      throw new HttpError(400, "Transfer ownership before leaving this clan", ErrorCode.VALIDATION);
    }
    sendOk(res, { clan: null });
  }));
  return router;
}
