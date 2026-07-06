import mongoose, { Schema } from "mongoose";

const relationshipSchema = new Schema(
  {
    users: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    pairKey: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    levelTitle: { type: String, default: "First Spark" },
    lastInteractionAt: Date
  },
  { timestamps: true }
);

relationshipSchema.index({ users: 1 });
relationshipSchema.index({ level: -1, xp: -1 });
relationshipSchema.index({ lastInteractionAt: -1 });

export const Relationship = mongoose.model("Relationship", relationshipSchema);
