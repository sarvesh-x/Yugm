import mongoose, { Schema } from "mongoose";

const battlePassXpGrantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", required: true },
    actionKey: { type: String, required: true },
    xpGained: { type: Number, required: true, min: 1 }
  },
  { timestamps: true }
);

battlePassXpGrantSchema.index({ userId: 1, seasonId: 1, actionKey: 1 }, { unique: true });

export const BattlePassXpGrant = mongoose.model("BattlePassXpGrant", battlePassXpGrantSchema);
