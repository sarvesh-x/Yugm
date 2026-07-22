import mongoose, { Schema } from "mongoose";

export interface IBattlePassReward {
  level: number;
  claimed: boolean;
  rewardId?: mongoose.Types.ObjectId;
}

export interface IBattlePass extends mongoose.Document {
  season: { id: mongoose.Types.ObjectId; name: string };
  userId: mongoose.Types.ObjectId;
  tier: "free" | "premium";
  level: number;
  xp: number;
  rewards: IBattlePassReward[];
  premium: boolean;
  expiresAt: Date;
}

const battlePassRewardSchema = new Schema<IBattlePassReward>({
  level: { type: Number, required: true },
  claimed: { type: Boolean, default: false },
  rewardId: { type: Schema.Types.ObjectId }
}, { _id: false });

const battlePassSchema = new Schema<IBattlePass>(
  {
    season: {
      id: { type: Schema.Types.ObjectId, ref: "Season", required: true },
      name: { type: String, required: true }
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tier: { type: String, enum: ["free", "premium"], default: "free" },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    rewards: [battlePassRewardSchema],
    premium: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

battlePassSchema.index({ userId: 1, "season.id": 1 }, { unique: true });

export const BattlePass = mongoose.model<IBattlePass>("BattlePass", battlePassSchema);
