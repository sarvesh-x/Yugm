import mongoose, { Schema } from "mongoose";
import type { UserRole } from "@yugm/shared";

export interface IUser extends mongoose.Document {
  name: string;
  username: string;
  email?: string;
  phone?: string;
  firebaseUid?: string;
  avatar?: string;
  gender?: string;
  age?: number;
  city?: string;
  bio?: string;
  interests: string[];
  languages: string[];
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  followersCount: number;
  followingCount: number;
  walletBalance: number;
  tokenVersion: number;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, sparse: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, sparse: true, unique: true, trim: true },
    firebaseUid: { type: String, sparse: true, unique: true },
    avatar: String,
    gender: String,
    age: Number,
    city: String,
    bio: String,
    interests: [{ type: String }],
    languages: [{ type: String }],
    role: { type: String, enum: ["USER", "HOST", "MODERATOR", "ADMIN"], default: "USER" },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
