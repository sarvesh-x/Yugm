import mongoose, { Schema } from "mongoose";

export type FriendMatchStatus = "WAITING" | "PAIRING" | "MATCHED" | "CANCELLED";

export interface FriendMatchRequestDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  status: FriendMatchStatus;
  matchedUserId?: mongoose.Types.ObjectId;
  roomId?: mongoose.Types.ObjectId;
  expiresAt: Date;
}

const friendMatchRequestSchema = new Schema<FriendMatchRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    status: { type: String, enum: ["WAITING", "PAIRING", "MATCHED", "CANCELLED"], required: true, index: true },
    matchedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

friendMatchRequestSchema.index({ status:  1, createdAt: 1, expiresAt: 1 });
friendMatchRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FriendMatchRequest = mongoose.model<FriendMatchRequestDocument>("FriendMatchRequest", friendMatchRequestSchema);
