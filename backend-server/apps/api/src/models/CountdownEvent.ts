import mongoose, { Schema } from "mongoose";

export interface ICountdownEvent extends mongoose.Document {
  title: string;
  description: string;
  targetDate: Date;
  type: "event" | "festival" | "special";
  coverImage?: string;
  color: string;
  isActive: boolean;
}

const countdownEventSchema = new Schema<ICountdownEvent>(
  {
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    targetDate: { type: Date, required: true },
    type: { type: String, enum: ["event", "festival", "special"], default: "event" },
    coverImage: String,
    color: { type: String, default: "#E91E63" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

countdownEventSchema.index({ isActive: 1, targetDate: 1 });

export const CountdownEvent = mongoose.model<ICountdownEvent>("CountdownEvent", countdownEventSchema);
