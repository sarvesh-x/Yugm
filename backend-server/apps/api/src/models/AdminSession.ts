import mongoose, { Schema } from "mongoose";

const adminSessionSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    ipAddress: String,
    userAgent: String,
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminSessionSchema.index({ adminId: 1, revokedAt: 1, expiresAt: 1 });

export const AdminSession = mongoose.model("AdminSession", adminSessionSchema);
