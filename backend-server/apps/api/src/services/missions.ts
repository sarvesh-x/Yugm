import mongoose from "mongoose";
import { Mission } from "../models/Mission.js";
import { UserMission } from "../models/UserMission.js";
import { grantXp } from "./levels.js";
import { creditWallet } from "./wallet.js";
import { HttpError, ErrorCode } from "../utils/http.js";

export async function getActiveMissions(userId: string) {
  const now = new Date();
  const missions = await Mission.find({
    active: true,
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }
    ]
  }).lean();

  const userMissions = await UserMission.find({ userId }).lean();
  const userMissionMap = new Map(userMissions.map((um) => [um.missionId.toString(), um]));

  const daily = missions.filter((m) => m.type === "daily");
  const weekly = missions.filter((m) => m.type === "weekly");
  const monthly = missions.filter((m) => m.type === "monthly");
  const seasonal = missions.filter((m) => m.type === "seasonal");

  function attachProgress(ms: typeof missions) {
    return ms.map((m) => {
      const um = userMissionMap.get(m._id.toString());
      return {
        ...m,
        progress: um?.progress ?? 0,
        completed: um?.completed ?? false,
        claimed: um?.claimed ?? false
      };
    });
  }

  return {
    daily: attachProgress(daily),
    weekly: attachProgress(weekly),
    monthly: attachProgress(monthly),
    seasonal: attachProgress(seasonal)
  };
}

export async function updateMissionProgress(
  userId: string,
  action: string,
  delta: number,
  session?: mongoose.ClientSession
) {
  const now = new Date();
  const missions = await Mission.find({
    active: true,
    "requirements.action": action,
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }
    ]
  }).session(session ?? null).lean();

  const results: { missionId: string; key: string; completed: boolean; progress: number; target: number }[] = [];

  for (const mission of missions) {
    const opts: Record<string, unknown> = {};
    if (session) opts.session = session;

    const updated = await UserMission.findOneAndUpdate(
      { userId, missionId: mission._id },
      {
        $inc: { progress: delta },
        $setOnInsert: { userId, missionId: mission._id, streakDay: 1 }
      },
      { upsert: true, new: true, ...opts }
    );

    const target = mission.requirements.target;
    const progress = Math.min(updated.progress, target);
    const wasJustCompleted = progress >= target && !updated.completed;

    if (wasJustCompleted) {
      await UserMission.findByIdAndUpdate(updated._id, {
        $set: { completed: true, completedAt: new Date() }
      }, opts);
    }

    results.push({
      missionId: mission._id.toString(),
      key: mission.key,
      completed: progress >= target,
      progress,
      target
    });
  }

  return results;
}

export async function claimMission(userId: string, missionId: string) {
  const mission = await Mission.findById(missionId).lean();
  if (!mission) throw new HttpError(404, "Mission not found", ErrorCode.NOT_FOUND);

  const userMission = await UserMission.findOne({ userId, missionId }).lean();
  if (!userMission || !userMission.completed) throw new HttpError(409, "Mission not completed", ErrorCode.CONFLICT);
  if (userMission.claimed) throw new HttpError(409, "Mission already claimed", ErrorCode.CONFLICT);

  const rewards: { xp?: number; coins?: number; diamonds?: number } = {};

  if (mission.rewards.xp > 0) {
    await grantXp(userId, "MISSION_REWARD", { missionId, idempotencyKey: `mission:${userId}:${missionId}` }, mission.rewards.xp);
    rewards.xp = mission.rewards.xp;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const claimed = await UserMission.findOneAndUpdate(
      { _id: userMission._id, userId, completed: true, $or: [{ claimed: false }, { claimed: { $exists: false } }] },
      { $set: { claimed: true } },
      { new: true, session }
    );
    if (!claimed) throw new HttpError(409, "Mission already claimed", ErrorCode.CONFLICT);
    if (mission.rewards.coins > 0) {
      await creditWallet(userId, mission.rewards.coins, "MISSION_REWARD", { missionId, idempotencyKey: `mission:${userId}:${missionId}` }, session);
      rewards.coins = mission.rewards.coins;
    }
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

  return { missionId, key: mission.key, rewards };
}
