import mongoose, { Schema } from "mongoose";

const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios", "web"], required: true },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);
