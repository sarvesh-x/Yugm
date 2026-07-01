import mongoose, { Schema } from "mongoose";

const speakerRequestSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" }
  },
  { timestamps: true }
);

speakerRequestSchema.index({ roomId: 1, userId: 1, status: 1 });

export const SpeakerRequest = mongoose.model("SpeakerRequest", speakerRequestSchema);
