import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { autoModerate } from "../middleware/autoModerate.js";
import { bondLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Bond, BondPoint, BondRankingSnapshot, BondRequest, type BondRecord } from "../models/Bond.js";
import { Block } from "../models/Block.js";
import { Clan } from "../models/Clan.js";
import { Friendship } from "../models/Friendship.js";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import {
  bondCheckIn, bondPeopleFields, bondPreferences, describeBond, endBond, expireBondRequests, listBondGifts,
  memberAvailable, pairBlockFilter, readBond, resolveBondRequest, sendBondGift, sendBondRequest, setBondPreferences
} from "../services/bonds.js";
import { bondConfig, bondKinds, bondLevels, ensureBondCatalog, rankingPeriod, rankingWindows, weeklyPeriod, type BondKind } from "../services/bondRules.js";
import { bondEnabled, optedIn, rankBonds, rankingCategories } from "../services/bondProgress.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i).transform(id => id.toLowerCase());
const actionKey = z.string().trim().regex(/^[\w-]{8,80}$/);
const kind = z.enum(Object.keys(bondKinds) as [BondKind, ...BondKind[]]);
const invite = z.object({
  recipient: objectId, kind, slot: z.number().int().positive().max(12), giftId: objectId.optional(),
  message: z.string().trim().max(160).optional(), key: actionKey
}).strict();
const preferences = z.object({
  visibility: z.enum(["PRIVATE", "FRIENDS", "PUBLIC"]).optional(),
  showDuration: z.boolean().optional(), showLevel: z.boolean().optional(), showBadge: z.boolean().optional(),
  showRanking: z.boolean().optional(), leaderboard: z.boolean().optional(), reminders: z.boolean().optional(),
  announcements: z.boolean().optional()
}).strict();
const invitationSettings = z.object({ enabled: z.boolean().optional(), push: z.boolean().optional() }).strict()
  .refine(value => value.enabled !== undefined || value.push !== undefined);
const typeChange = z.object({ kind, key: actionKey }).strict();
const giftInput = z.object({ giftId: objectId, key: actionKey }).strict();

const people = async (ids: string[]) => {
  const users = await User.find({ _id: { $in: [...new Set(ids)] } }).select(bondPeopleFields).lean();
  return new Map(users.map(user => [String(user._id), user]));
};
function person(user?: { _id: unknown; name: string; username?: string; avatar?: string | null }) {
  return user ? { id: String(user._id), name: user.name, username: user.username, avatar: user.avatar } : null;
}
const partnerId = (bond: BondRecord, user: string) => bond.users.map(String).find(id => id !== user) ?? "";

async function usersWithOpenSlots(ids: string[], now = new Date()) {
  if (!ids.length) return new Set<string>();
  const [active, sent, restricted] = await Promise.all([
    Bond.find({ users: { $in: ids }, status: "ACTIVE" }).select("users").lean(),
    BondRequest.find({ senderId: { $in: ids }, status: "PENDING", bondId: null, expiresAt: { $gt: now } }).select("senderId").lean(),
    UserSafetyStatus.find({ userId: { $in: ids }, $or: [{ isShadowBanned: true }, { isChatRestricted: true }] }).select("userId").lean()
  ]);
  const usage = new Map(ids.map(id => [id, 0]));
  const occupy = (id: string) => {
    const current = usage.get(id);
    if (current !== undefined) usage.set(id, current + 1);
  };
  active.forEach(bond => bond.users.forEach(id => occupy(String(id))));
  sent.forEach(request => occupy(String(request.senderId)));
  restricted.forEach(row => usage.delete(String(row.userId)));
  return new Set([...usage].filter(([, count]) => count < bondConfig.capacity).map(([id]) => id));
}

export const bondsRouter = Router();
bondsRouter.use(requireAuth, (_req, _res, next) => next(bondEnabled() ? undefined : new HttpError(404, "Bonds is unavailable")), bondLimiter);

bondsRouter.get("/me", asyncHandler(async (req: AuthRequest, res) => {
  const id = req.user!.id;
  await expireBondRequests(id);
  const [active, ended, requests, user] = await Promise.all([
    Bond.find({ users: id, status: "ACTIVE" }).lean(),
    Bond.find({ users: id, status: { $ne: "ACTIVE" } }).sort({ endedAt: -1 }).limit(25).lean(),
    BondRequest.find({ status: "PENDING", expiresAt: { $gt: new Date() }, $or: [{ senderId: id }, { recipientId: id }] }).sort({ createdAt: -1 }).limit(100).lean(),
    User.findById(id).select("age walletBalance bondInvitations bondNotifications").lean()
  ]);
  const partners = await people([...active, ...ended].map(bond => partnerId(bond, id))
    .concat(requests.map(row => String(String(row.senderId) === id ? row.recipientId : row.senderId))));
  const display = (bond: BondRecord) => ({ ...describeBond(bond), partner: person(partners.get(partnerId(bond, id))),
    slot: bond.slots[bond.users.findIndex(userId => String(userId) === id)] });
  sendOk(res, {
    capacity: bondConfig.capacity, freeInvitations: bondConfig.freeInvitations, invitationHours: bondConfig.invitationHours,
    levels: bondLevels, balance: user?.walletBalance ?? 0, allowsRequests: user?.bondInvitations !== false, pushEnabled: user?.bondNotifications !== false,
    eligible: memberAvailable(user), kinds: Object.entries(bondKinds).map(([id, value]) => ({ id, ...value })),
    active: active.filter(bond => memberAvailable(partners.get(partnerId(bond, id)) ?? null)).map(display),
    ended: ended.map(display),
    requests: requests.map(row => {
      const incoming = String(row.recipientId) === id;
      return { id: String(row._id), kind: row.kind, typeChange: row.bondId != null, incoming, slot: row.slot, message: row.message,
        expiresAt: row.expiresAt, giftName: row.giftName, giftIcon: row.giftIcon, price: row.price, version: row.version,
        partner: person(partners.get(String(incoming ? row.senderId : row.recipientId))) };
    })
  });
}));

bondsRouter.get("/gift-catalog", asyncHandler(async (_req, res) => sendOk(res, { gifts: await listBondGifts() })));

bondsRouter.get("/eligible-friends", asyncHandler(async (req: AuthRequest, res) => {
  const id = req.user!.id;
  if (!memberAvailable(req.user!)) return sendOk(res, { friends: [] });
  const search = String(req.query.q ?? "").trim().slice(0, 60).toLowerCase();
  const [friends, blocks, bonds, invitations] = await Promise.all([
    Friendship.find({ status: "ACCEPTED", $or: [{ userId: id }, { friendId: id }] }).select("userId friendId").limit(500).lean(),
    Block.find({ $or: [{ blockerId: id }, { blockedUserId: id }] }).select("blockerId blockedUserId").lean(),
    Bond.find({ users: id, status: "ACTIVE" }).select("users").lean(),
    BondRequest.find({ status: "PENDING", expiresAt: { $gt: new Date() }, $or: [{ senderId: id }, { recipientId: id }] }).select("senderId recipientId").lean()
  ]);
  const unavailable = new Set([id, ...blocks.flatMap(row => [String(row.blockerId), String(row.blockedUserId)]),
    ...bonds.flatMap(row => row.users.map(String)), ...invitations.flatMap(row => [String(row.senderId), String(row.recipientId)])]);
  const candidates = await people(friends.flatMap(row => [String(row.userId), String(row.friendId)]).filter(value => !unavailable.has(value)));
  const eligible = [...candidates.values()].filter(user => memberAvailable(user) && user.bondInvitations !== false &&
    (!search || `${user.name} ${user.username ?? ""}`.toLowerCase().includes(search)));
  const open = await usersWithOpenSlots([id, ...eligible.map(user => String(user._id))]);
  sendOk(res, { friends: open.has(id) ? eligible.filter(user => open.has(String(user._id))).slice(0, 100).map(person) : [] });
}));

bondsRouter.get("/profile/:id", asyncHandler(async (req: AuthRequest, res) => {
  const owner = req.params.id.toLowerCase();
  const viewer = req.user!.id;
  if (!isValidObjectId(owner)) throw new HttpError(400, "Invalid profile");
  const empty = () => sendOk(res, { bonds: [], canInvite: false });
  const users = await people([owner, viewer]);
  if (!memberAvailable(users.get(owner) ?? null) || await Block.exists(pairBlockFilter(owner, viewer))) return empty();
  const entries = await Bond.find({ users: owner, status: "ACTIVE" }).limit(12).lean();
  const partners = await people(entries.map(entry => partnerId(entry, owner)));
  const priorWeek = weeklyPeriod(new Date(weeklyPeriod(new Date()).start.getTime() - 1));
  const weeklyRanking = entries.length
    ? await BondRankingSnapshot.findOne({ period: priorWeek.id, category: "ACTIVITY" }).select("entries").lean()
    : null;
  const cards = [];
  for (const bond of entries) {
    const other = partnerId(bond, owner);
    if (!memberAvailable(partners.get(other) ?? null) || await Block.exists(pairBlockFilter(viewer, other)) || await Block.exists(pairBlockFilter(owner, other))) continue;
    const settings = bond.users.map(id => bondPreferences(bond, String(id)));
    if (viewer !== owner && viewer !== other) {
      if (settings.some(value => value.visibility === "PRIVATE")) continue;
      if (settings.some(value => value.visibility === "FRIENDS")) {
        const friends = await Friendship.countDocuments({ status: "ACCEPTED", $or: [
          { userId: viewer, friendId: { $in: [owner, other] } }, { userId: { $in: [owner, other] }, friendId: viewer }
        ] });
        const friendIds = friends >= 2 ? await Friendship.find({ status: "ACCEPTED", $or: [
          { userId: viewer, friendId: { $in: [owner, other] } }, { userId: { $in: [owner, other] }, friendId: viewer }
        ] }).select("userId friendId").lean() : [];
        if (!friendIds.some(f => [String(f.userId), String(f.friendId)].includes(owner)) ||
            !friendIds.some(f => [String(f.userId), String(f.friendId)].includes(other))) continue;
      }
    }
    const summary = describeBond(bond);
    const rank = weeklyRanking?.entries.find(row => String(row.bondId) === summary.id)?.rank ?? 0;
    const showRank = rank > 0 && rank <= 10 && settings.every(value => value.showRanking && value.leaderboard && value.visibility === "PUBLIC");
    cards.push({ id: summary.id, kind: summary.kind, kindName: summary.kindName, partner: person(partners.get(other)),
      ...(settings.every(value => value.showDuration) || viewer === owner ? { days: summary.days } : {}),
      ...(settings.every(value => value.showLevel) || viewer === owner ? { level: summary.level } : {}),
      showBadge: settings.every(value => value.showBadge),
      ...(showRank ? { weeklyRank: rank } : {}) });
  }
  const pair = [owner, viewer].sort().join(":");
  const mayInvite = viewer !== owner && memberAvailable(users.get(viewer) ?? null) && users.get(owner)?.bondInvitations !== false &&
    !entries.some(bond => bond.pairKey === pair) &&
    !await BondRequest.exists({ pairKey: pair, status: "PENDING", expiresAt: { $gt: new Date() } }) &&
    !!await Friendship.exists({ status: "ACCEPTED", $or: [{ userId: owner, friendId: viewer }, { userId: viewer, friendId: owner }] });
  const canInvite = mayInvite && (await usersWithOpenSlots([owner, viewer])).size === 2;
  sendOk(res, { bonds: cards, canInvite });
}));

bondsRouter.get("/leaderboards", asyncHandler(async (req: AuthRequest, res) => {
  const category = z.enum(rankingCategories).catch("ACTIVITY").parse(req.query.category);
  const window = z.enum(rankingWindows).catch("WEEK").parse(req.query.window);
  const kindFilter = kind.optional().catch(undefined).parse(req.query.kind);
  const scope = z.enum(["GLOBAL", "FRIENDS", "COMMUNITY"]).catch("GLOBAL").parse(req.query.scope);
  const viewer = req.user!.id;
  let network: Set<string> | undefined;
  if (scope === "FRIENDS") {
    const friendships = await Friendship.find({
      status: "ACCEPTED", $or: [{ userId: viewer }, { friendId: viewer }]
    }).select("userId friendId").lean();
    network = new Set(friendships.map(row => String(String(row.userId) === viewer ? row.friendId : row.userId)));
  } else if (scope === "COMMUNITY") {
    const clan = await Clan.findOne({ memberIds: viewer }).select("memberIds").lean();
    network = new Set(clan?.memberIds.map(String));
    network.delete(viewer);
  }
  const now = new Date();
  const current = rankingPeriod(now, window);
  const finalized = req.query.period === "previous";
  const period = finalized ? rankingPeriod(new Date(current.start.getTime() - 1), window) : current;
  const snapshot = finalized ? await BondRankingSnapshot.findOne({ period: period.id, category }).lean() : null;
  const ranked = finalized ? snapshot?.entries ?? [] : await rankBonds(category, period, now);
  const data = await Bond.find({ _id: { $in: ranked.map(entry => entry.bondId) }, status: "ACTIVE" }).lean();
  const byId = new Map(data.map(bond => [String(bond._id), bond]));
  const participants = await people(data.flatMap(bond => bond.users.map(String)));
  const visibleNetwork = network;
  const entries = [];
  for (const rank of ranked) {
    const bond = byId.get(String(rank.bondId));
    if (!bond || (kindFilter && bond.kind !== kindFilter)) continue;
    const ids = bond.users.map(String);
    if ((visibleNetwork && !ids.some(id => visibleNetwork.has(id))) || !await optedIn(bond)) continue;
    if (await Block.exists({ $or: [{ blockerId: viewer, blockedUserId: { $in: ids } }, { blockerId: { $in: ids }, blockedUserId: viewer }] })) continue;
    entries.push({ rank: rank.rank, score: rank.score, kind: bond.kind, people: ids.map(id => person(participants.get(id))) });
  }
  sendOk(res, { category, window, scope, period, finalized: !!snapshot, entries });
}));

bondsRouter.put("/invitation-settings", validateBody(invitationSettings), asyncHandler(async (req: AuthRequest, res) => {
  const settings = {
    ...(req.body.enabled === undefined ? {} : { bondInvitations: req.body.enabled }),
    ...(req.body.push === undefined ? {} : { bondNotifications: req.body.push })
  };
  await User.updateOne({ _id: req.user!.id }, { $set: settings, $inc: { bondVersion: 1 } });
  sendOk(res, { updated: true });
}));

bondsRouter.post("/invitations", validateBody(invite), autoModerate("message"), asyncHandler(async (req: AuthRequest, res) => {
  await ensureBondCatalog();
  sendOk(res, await sendBondRequest(req.user!.id, req.body), 201);
}));

for (const [route, action] of [["accept", "ACCEPTED"], ["decline", "DECLINED"], ["cancel", "CANCELLED"]] as const) {
  bondsRouter.post(`/invitations/:id/${route}`, asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, await resolveBondRequest(req.params.id, req.user!.id, action));
  }));
}

bondsRouter.get("/:id", asyncHandler(async (req: AuthRequest, res) => {
  const bond = await readBond(req.params.id, req.user!.id);
  const partner = partnerId(bond, req.user!.id);
  const [users, activity] = await Promise.all([
    people(bond.users.map(String)),
    BondPoint.find({ bondId: bond._id, kind: { $ne: "CHECK_IN" } }).select("kind points createdAt").sort({ createdAt: -1 }).limit(20).lean()
  ]);
  sendOk(res, { ...describeBond(bond), partner: person(users.get(partner)), self: person(users.get(req.user!.id)),
    preferences: bondPreferences(bond, req.user!.id), activity });
}));

bondsRouter.patch("/:id/preferences", validateBody(preferences), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await setBondPreferences(req.params.id, req.user!.id, req.body));
}));
bondsRouter.post("/:id/check-in", asyncHandler(async (req: AuthRequest, res) =>
  sendOk(res, await bondCheckIn(req.params.id, req.user!.id))));
bondsRouter.post("/:id/gifts", validateBody(giftInput), asyncHandler(async (req: AuthRequest, res) =>
  sendOk(res, await sendBondGift(req.params.id, req.user!.id, req.body.giftId, req.body.key))));
bondsRouter.post("/:id/type-change", validateBody(typeChange), asyncHandler(async (req: AuthRequest, res) => {
  const bond = await readBond(req.params.id, req.user!.id);
  sendOk(res, await sendBondRequest(req.user!.id, { ...req.body, recipient: partnerId(bond, req.user!.id), bondId: req.params.id }), 201);
}));
bondsRouter.post("/:id/end", asyncHandler(async (req: AuthRequest, res) =>
  sendOk(res, await endBond(req.params.id, req.user!.id))));

