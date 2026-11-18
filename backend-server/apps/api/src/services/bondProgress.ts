import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Bond, BondPoint, BondRankingSnapshot, BondReward, type BondRecord } from "../models/Bond.js";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { addBondReward, bondDays, bondPeopleFields, bondPreferences, expireBondRequests, memberAvailable, pairBlockFilter, publishBonds } from "./bonds.js";
import { anniversaryLeadMs, bondConfig, bondRewardItems, dayMs, ensureBondCatalog, milestones, nextAnniversary, rankingPeriod, rankingWindows, type RankingWindow } from "./bondRules.js";

export const rankingCategories = ["SUPPORT", "ACTIVITY", "LONGEST"] as const;
export type RankingCategory = typeof rankingCategories[number];
export const bondEnabled = () => env.YUGM_BONDS_ENABLED ?? env.NODE_ENV !== "production";

export async function optedIn(bond: BondRecord) {
  const [a, b] = bond.users.map(String);
  if (!a || !b || ![a, b].every(id => {
    const preference = bondPreferences(bond, id);
    return preference.leaderboard && preference.visibility === "PUBLIC";
  })) return false;
  if (await Block.exists(pairBlockFilter(a, b))) return false;
  const users = await User.find({ _id: { $in: [a, b] } }).select(bondPeopleFields).lean();
  return users.length === 2 && users.every(person => memberAvailable(person));
}

export async function rankBonds(category: RankingCategory, period: ReturnType<typeof rankingPeriod>, at = new Date()) {
  const scores = category === "LONGEST" ? [] : await BondPoint.aggregate<{ _id: mongoose.Types.ObjectId; score: number }>([
    { $match: { createdAt: { $gte: period.start, $lt: period.end }, kind: category === "SUPPORT" ? "GIFT" : "ACTIVITY" } },
    { $group: { _id: "$bondId", score: { $sum: category === "SUPPORT" ? "$support" : "$points" } } },
    { $match: { score: { $gt: 0 } } },
    { $sort: { score: -1, _id: 1 } },
    { $limit: 500 }
  ]);
  const bonds = await Bond.find({ status: "ACTIVE", activatedAt: { $lt: period.end },
    ...(category === "LONGEST" ? {} : { _id: { $in: scores.map(row => row._id) } }) })
    .sort({ activatedAt: 1, _id: 1 }).limit(500).lean();
  const scoreMap = new Map(scores.map(row => [String(row._id), row.score]));
  const sorted = bonds.map(bond => ({ bond,
    score: category === "LONGEST" ? bondDays(bond, at) : (scoreMap.get(String(bond._id)) ?? 0)
  })).sort((a, b) => b.score - a.score || String(a.bond._id).localeCompare(String(b.bond._id)));
  const entries: { bondId: mongoose.Types.ObjectId; score: number; rank: number }[] = [];
  for (const { bond, score } of sorted) {
    if (await optedIn(bond)) entries.push({ bondId: bond._id, score, rank: entries.length + 1 });
    if (entries.length === 50) break;
  }
  return entries;
}

async function finalizeBondPeriod(now: Date, window: RankingWindow) {
  const prior = rankingPeriod(new Date(rankingPeriod(now, window).start.getTime() - 1), window);
  for (const category of rankingCategories) {
    const existing = await BondRankingSnapshot.exists({ period: prior.id, category });
    if (existing) continue;
    const entries = await rankBonds(category, prior, prior.end);
    const delivery = await mongoose.connection.transaction(async session => {
      const snapshot = await BondRankingSnapshot.updateOne({ period: prior.id, category }, {
        $setOnInsert: { entries, finalizedAt: now }
      }, { session, upsert: true });
      if (!snapshot.upsertedCount) return [];
      const notes = [];
      // Cosmetic rewards recognize reciprocal activity rather than spending.
      if (category === "ACTIVITY") {
        for (const entry of entries.slice(0, window === "WEEK" ? 3 : 1)) {
          const bond = await Bond.findOne({ _id: entry.bondId, status: "ACTIVE" }).session(session).lean();
          if (bond && bond.users.every(id => {
            const settings = bondPreferences(bond, String(id));
            return settings.visibility === "PUBLIC" && settings.leaderboard;
          })) {
            await addBondReward(bond, `rank:${prior.id}:ACTIVITY`, bondRewardItems.weekly, now, session, new Date(now.getTime() + 7 * dayMs));
            notes.push(...await Notification.create(bond.users.map(userId => ({
              userId, type: "SYSTEM", title: "Bond ranking reward unlocked",
              body: "Your Bonds Champion frame is available in Backpack for seven days.",
              data: { type: "BONDS", kind: "RANK_REWARD", bondId: String(bond._id) }
            })), { session, ordered: true }));
          }
        }
      }
      return notes;
    });
    if (delivery.length) publishBonds(delivery.map(note => String(note.userId)), undefined, undefined, delivery);
  }
}

export async function sendBondAnniversaryReminders(now: Date) {
  const due = await Bond.find({
    status: "ACTIVE",
    $or: [{ anniversaryReminderAt: { $lte: now } }, { anniversaryReminderAt: { $exists: false } }]
  }).select("_id").limit(100).lean();
  for (const item of due) {
    const delivery = await mongoose.connection.transaction(async session => {
      const bond = await Bond.findOne({ _id: item._id, status: "ACTIVE",
        $or: [{ anniversaryReminderAt: { $lte: now } }, { anniversaryReminderAt: { $exists: false } }]
      }).session(session).lean();
      if (!bond) return [];
      const anniversary = nextAnniversary(bond.activatedAt, now);
      const remind = anniversary.getTime() - now.getTime() <= anniversaryLeadMs;
      const next = remind ? nextAnniversary(bond.activatedAt, anniversary) : anniversary;
      await Bond.updateOne({ _id: bond._id }, {
        $set: { anniversaryReminderAt: new Date(next.getTime() - anniversaryLeadMs) }
      }, { session });
      if (!remind) return [];
      return Notification.create(bond.users.filter(id => bondPreferences(bond, String(id)).reminders).map(userId => ({
        userId, type: "SYSTEM", title: "A bond anniversary is coming up",
        body: "See your upcoming anniversary in My Bonds.",
        data: { type: "BONDS", kind: "ANNIVERSARY_REMINDER", bondId: String(bond._id) }
      })), { session, ordered: true });
    });
    if (delivery.length) publishBonds(delivery.map(note => String(note.userId)), undefined, undefined, delivery);
  }
}

export async function expireBondRewards(now: Date) {
  const due = await BondReward.find({ expiredAt: null, expiresAt: { $lte: now } }).select("_id userId itemId").limit(100).lean();
  for (const item of due) {
    await mongoose.connection.transaction(async session => {
      const changed = await BondReward.updateOne({ _id: item._id, expiredAt: null }, { $set: { expiredAt: now } }, { session });
      if (!changed.modifiedCount) return;
      const otherGrant = await BondReward.exists({ userId: item.userId, itemId: item.itemId, expiredAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).session(session);
      if (otherGrant) return;
      // The item is reward-only. Removing its last active entitlement cannot remove a purchased item.
      await User.updateOne({ _id: item.userId }, { $pull: { ownedCosmeticIds: item.itemId } }, { session });
      await User.updateOne({ _id: item.userId, "activeCosmetics.avatarFrame": item.itemId },
        { $unset: { "activeCosmetics.avatarFrame": "" } }, { session });
    });
    publishBonds([String(item.userId)]);
  }
}

export async function runBondMaintenance(now = new Date()) {
  await expireBondRequests(undefined, now);
  await expireBondRewards(now);
  if (!bondEnabled()) return;
  await ensureBondCatalog();
  const due = await Bond.find({ status: "ACTIVE", nextMilestoneAt: { $lte: now } }).select("_id").limit(100).lean();
  for (const item of due) {
    const result = await mongoose.connection.transaction(async session => {
      const bond = await Bond.findOne({ _id: item._id, status: "ACTIVE", nextMilestoneAt: { $lte: now } }).session(session).lean();
      if (!bond) return;
      const days = bondDays(bond, now);
      const reached = milestones.filter(day => day <= days && !bond.milestoneDays.includes(day));
      const upcoming = milestones.find(day => day > days);
      const next = upcoming ? new Date(bond.activatedAt.getTime() + upcoming * dayMs) : null;
      await Bond.updateOne({ _id: bond._id, status: "ACTIVE" }, {
        $addToSet: { milestoneDays: { $each: reached } }, $inc: { points: reached.length * bondConfig.milestonePoints, version: 1 },
        $set: { nextMilestoneAt: next }
      }, { session });
      if (!reached.length) return;
      await BondPoint.insertMany(reached.map(day => ({
        bondId: bond._id, key: `milestone:${day}`, kind: "MILESTONE", points: bondConfig.milestonePoints
      })), { session, ordered: true });
      if (reached.some(day => day >= 7)) await addBondReward(bond, "milestone:7", bondRewardItems.milestone, now, session);
      const ids = bond.users.map(String);
      const notes = await Notification.create(ids.filter(id => bondPreferences(bond, id).reminders).map(userId => ({
        userId, type: "SYSTEM", title: "Bond milestone reached", body: "Open My Bonds to see what you unlocked.",
        data: { type: "BONDS", kind: "MILESTONE", bondId: String(bond._id) }
      })), { session, ordered: true });
      return { ids, notes };
    });
    if (result) publishBonds(result.ids, undefined, undefined, result.notes);
  }
  for (const window of rankingWindows) await finalizeBondPeriod(now, window);
  await sendBondAnniversaryReminders(now);
}

