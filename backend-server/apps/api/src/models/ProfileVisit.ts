import mongoose, { Schema } from "mongoose";

const profileVisitSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    visitorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastVisitedAt: { type: Date, default: Date.now, required: true }
  },
  { timestamps: true }
);

profileVisitSchema.index({ profileId: 1, visitorId: 1 }, { unique: true });
profileVisitSchema.index({ profileId: 1, lastVisitedAt: -1 });

export const ProfileVisit = mongoose.model("ProfileVisit", profileVisitSchema);
