import mongoose, { Schema } from "mongoose";

export interface IStoryHighlight extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  coverMediaUrl?: string;
  storyIds: mongoose.Types.ObjectId[];
}

const storyHighlightSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 40 },
  coverMediaUrl: String,
  storyIds: [{ type: Schema.Types.ObjectId, ref: "Story" }],
}, { timestamps: true });

export const StoryHighlight = mongoose.model<IStoryHighlight>("StoryHighlight", storyHighlightSchema);
