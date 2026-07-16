import mongoose, { Schema } from "mongoose";
import type { AdminRole } from "../modules/admin/permissions.js";

export type AdminStatus = "ACTIVE" | "SUSPENDED" | "DISABLED" | "INVITED";

export interface IAdminUser extends mongoose.Document {
  userId?: mongoose.Types.ObjectId;
  firebaseUid?: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: AdminRole;
  status: AdminStatus;
  permissions: string[];
  isSuperAdmin: boolean;
  passwordHash?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorTempSecret?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  createdBy?: mongoose.Types.ObjectId;
  invitationTokenHash?: string;
  invitationExpiresAt?: Date;
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    firebaseUid: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: String,
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "MODERATOR", "FINANCE_MANAGER", "SUPPORT_AGENT", "CONTENT_REVIEWER", "ROOM_MODERATOR", "ANALYST"],
      required: true
    },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED", "DISABLED", "INVITED"], default: "ACTIVE", index: true },
    permissions: [{ type: String }],
    isSuperAdmin: { type: Boolean, default: false },
    passwordHash: String,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    twoFactorTempSecret: String,
    lastLoginAt: Date,
    lastLoginIp: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    invitationTokenHash: { type: String, select: false },
    invitationExpiresAt: Date
  },
  { timestamps: true }
);

adminUserSchema.index({ role: 1, status: 1 });

export const AdminUser = mongoose.model<IAdminUser>("AdminUser", adminUserSchema);
