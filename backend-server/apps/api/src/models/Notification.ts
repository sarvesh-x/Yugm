import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: "FOLLOW" | "GIFT" | "ROOM_INVITE" | "SPEAKER_APPROVED" | "MESSAGE" | "MOMENT" | "COMMENT" | "SYSTEM" | "FRIEND_REQUEST" | "FRIEND_ACCEPT" | "SUBSCRIPTION" | "WAVE";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["FOLLOW", "GIFT", "ROOM_INVITE", "SPEAKER_APPROVED", "MESSAGE", "MOMENT", "COMMENT", "SYSTEM", "FRIEND_REQUEST", "FRIEND_ACCEPT", "SUBSCRIPTION", "WAVE"], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification: Model<INotification> = mongoose.model<INotification>("Notification", notificationSchema);
