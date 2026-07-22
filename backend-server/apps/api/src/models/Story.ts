import mongoose, { Schema } from "mongoose";

export interface IStory extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO";
  caption?: string;
  backgroundColor?: string;
  textColor?: string;
  font?: string;
  sticker?: string;
  linkUrl?: string;
  duration?: number;
  transcript?: string;
  viewedBy: mongoose.Types.ObjectId[];
  likeCount: number;
  replyCount: number;
  expiresAt: Date;
  status: "ACTIVE" | "EXPIRED" | "HIDDEN";
}

const storySchema = new Schema<IStory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["IMAGE", "VIDEO", "AUDIO"], required: true },
    caption: { type: String, trim: true, maxlength: 200 },
    backgroundColor: String,
    textColor: String,
    font: String,
    sticker: String,
    linkUrl: String,
    duration: { type: Number, min: 1, max: 300 },
    transcript: { type: String, maxlength: 1000 },
    viewedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "HIDDEN"], default: "ACTIVE", index: true }
  },
  { timestamps: true }
);

storySchema.index({ userId: 1, status: 1, expiresAt: -1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.model<IStory>("Story", storySchema);
