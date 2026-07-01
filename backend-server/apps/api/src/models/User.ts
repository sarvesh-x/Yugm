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
  state?: string;
  bio?: string;
  vibeLine?: string;
  interests: string[];
  languages: string[];
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  followersCount: number;
  followingCount: number;
  walletBalance: number;
  tokenVersion: number;
  interestedIn?: string;
  lookingFor?: string;
  datingAgeMin?: number;
  datingAgeMax?: number;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    firebaseUid: String,
    avatar: String,
    gender: String,
    age: Number,
    city: String,
    state: String,
    bio: String,
    vibeLine: String,
    interests: [{ type: String }],
    languages: [{ type: String }],
    role: { type: String, enum: ["USER", "HOST", "MODERATOR", "ADMIN"], default: "USER" },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    tokenVersion: { type: Number, default: 0 },
    interestedIn: String,
    lookingFor: String,
    datingAgeMin: Number,
    datingAgeMax: Number,
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
userSchema.index({ firebaseUid: 1 }, { unique: true, partialFilterExpression: { firebaseUid: { $type: "string" } } });

export const User = mongoose.model<IUser>("User", userSchema);
