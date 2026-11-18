import mongoose, { Schema } from "mongoose";

const followSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followingId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Followers lists, profile counts, and room-create fan-out query by followingId.
followSchema.index({ followingId: 1, createdAt: -1 });

export const Follow = mongoose.model("Follow", followSchema);
