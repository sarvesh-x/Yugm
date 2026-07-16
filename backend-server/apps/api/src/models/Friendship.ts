import mongoose, { Schema } from "mongoose";
export interface IFriendship extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  friendId: mongoose.Types.ObjectId;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
}
const friendshipSchema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, friendId: { type: Schema.Types.ObjectId, ref: "User", required: true }, status: { type: String, enum: ["PENDING", "ACCEPTED", "BLOCKED"], default: "PENDING" } }, { timestamps: true });
friendshipSchema.index({ userId: 1, status: 1 });
friendshipSchema.index({ friendId: 1, status: 1 });
friendshipSchema.index({ userId: 1, friendId: 1 }, { unique: true });
export const Friendship = mongoose.model<IFriendship>("Friendship", friendshipSchema);
