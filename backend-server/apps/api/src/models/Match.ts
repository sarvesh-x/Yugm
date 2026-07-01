import mongoose, { Schema } from "mongoose";

const matchSchema = new Schema(
  {
    users: [{ type: Schema.Types.ObjectId, ref: "User", required: true }]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index on users array for fast queries
matchSchema.index({ users: 1 });

export const Match = mongoose.model("Match", matchSchema);
