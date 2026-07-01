import mongoose, { Schema } from "mongoose";

export interface IPoll extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  question: string;
  options: { text: string; votes: number }[];
  voters: mongoose.Types.ObjectId[];
  isActive: boolean;
}

const pollSchema = new Schema<IPoll>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: String, required: true, trim: true },
    options: [{
      text: { type: String, required: true, trim: true },
      votes: { type: Number, default: 0 }
    }],
    voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

pollSchema.index({ roomId: 1, createdAt: -1 });

export const Poll = mongoose.model<IPoll>("Poll", pollSchema);
