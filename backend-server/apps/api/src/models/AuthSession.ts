import mongoose, { Schema } from "mongoose";

const authSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  familyId: { type: String, required: true, index: true },
  refreshHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedByHash: String,
  ip: String,
  userAgent: String,
  lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true });

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ familyId: 1, revokedAt: 1 });

export const AuthSession = mongoose.model("AuthSession", authSessionSchema);
