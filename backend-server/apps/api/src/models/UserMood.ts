import mongoose, { Schema } from "mongoose";

export interface IUserMood extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  mood: string;
  emoji: string;
  activity: string;
  activityRoomId?: mongoose.Types.ObjectId;
  isActive: boolean;
  expiresAt: Date;
}

const userMoodSchema = new Schema<IUserMood>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    mood: { type: String, default: "" },
    emoji: { type: String, default: "" },
    activity: { type: String, default: "" },
    activityRoomId: { type: Schema.Types.ObjectId, ref: "Room" },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

userMoodSchema.index({ isActive: 1 });
userMoodSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserMood = mongoose.model<IUserMood>("UserMood", userMoodSchema);
