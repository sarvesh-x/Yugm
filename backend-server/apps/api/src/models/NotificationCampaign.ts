import mongoose, { Schema } from "mongoose";

export interface INotificationCampaign extends mongoose.Document {
  title: string;
  body: string;
  segment: "all" | "hosts" | "city" | "vip" | "custom";
  segmentValue?: string;
  filters?: Record<string, unknown>;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
  scheduledFor?: Date;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  createdBy: mongoose.Types.ObjectId;
  sentAt?: Date;
  completedAt?: Date;
}

const notificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    segment: { type: String, enum: ["all", "hosts", "city", "vip", "custom"], required: true },
    segmentValue: String,
    filters: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"], default: "DRAFT" },
    scheduledFor: Date,
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    sentAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

export const NotificationCampaign = mongoose.model<INotificationCampaign>("NotificationCampaign", notificationCampaignSchema);
