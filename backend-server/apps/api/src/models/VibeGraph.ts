import mongoose, { Schema } from "mongoose";

export interface IVibeGraph extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  interests: string[];
  languages: string[];
  city: string;
  vibeScore: number;
  totalInteractions: number;
  lastVibeUpdate: Date;
}

const vibeGraphSchema = new Schema<IVibeGraph>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    interests: [{ type: String }],
    languages: [{ type: String }],
    city: { type: String, default: "" },
    vibeScore: { type: Number, default: 0, min: 0, max: 100 },
    totalInteractions: { type: Number, default: 0 },
    lastVibeUpdate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

vibeGraphSchema.index({ userId: 1 }, { unique: true });

export const VibeGraph = mongoose.model<IVibeGraph>("VibeGraph", vibeGraphSchema);
