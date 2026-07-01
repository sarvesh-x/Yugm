import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    likerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    likedId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["LIKE", "SUPER_LIKE", "PASS"], default: "LIKE" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

likeSchema.index({ likerId: 1, likedId: 1 }, { unique: true });
likeSchema.index({ likedId: 1 });

export const Like = mongoose.model("Like", likeSchema);
