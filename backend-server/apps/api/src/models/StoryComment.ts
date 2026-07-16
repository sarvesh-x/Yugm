import mongoose, { Schema } from "mongoose";

export interface IStoryComment extends mongoose.Document {
  storyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

const storyCommentSchema = new Schema<IStoryComment>(
  {
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "StoryComment", default: null },
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

storyCommentSchema.index({ storyId: 1, createdAt: -1 });
storyCommentSchema.index({ parentId: 1 });

export const StoryComment = mongoose.model<IStoryComment>("StoryComment", storyCommentSchema);
