import mongoose, { Schema } from "mongoose";

export interface IXpDailyCap extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  event: string;
  day: Date;
  amount: number;
}

const xpDailyCapSchema = new Schema<IXpDailyCap>({
  userId: { type: Schema.Types.ObjectId, required: true },
  event: { type: String, required: true },
  day: { type: Date, required: true },
  amount: { type: Number, required: true, default: 0 }
}, { timestamps: true });

xpDailyCapSchema.index({ userId: 1, event: 1, day: 1 }, { unique: true });
xpDailyCapSchema.index({ day: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const XpDailyCap = mongoose.model<IXpDailyCap>("XpDailyCap", xpDailyCapSchema);
