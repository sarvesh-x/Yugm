import mongoose, { Schema } from "mongoose";

export interface IUserMission extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  missionId: mongoose.Types.ObjectId;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  claimed: boolean;
  streakDay: number;
}

const userMissionSchema = new Schema<IUserMission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    missionId: { type: Schema.Types.ObjectId, ref: "Mission", required: true },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: Date,
    claimed: { type: Boolean, default: false },
    streakDay: { type: Number, default: 1 }
  },
  { timestamps: true }
);

userMissionSchema.index({ userId: 1, missionId: 1 }, { unique: true });
userMissionSchema.index({ userId: 1, completed: 1 });

export const UserMission = mongoose.model<IUserMission>("UserMission", userMissionSchema);
