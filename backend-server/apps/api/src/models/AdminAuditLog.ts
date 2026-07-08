import mongoose, { Schema } from "mongoose";

const adminAuditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser", index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = mongoose.model("AdminAuditLog", adminAuditLogSchema);
