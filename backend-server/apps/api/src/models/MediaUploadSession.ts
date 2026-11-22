import mongoose, { Schema, type Document } from "mongoose";
import { mediaCategories, type MediaCategory } from "../services/r2.js";

export const uploadSessionStatuses = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "EXPIRED", "FAILED"] as const;
export type UploadSessionStatus = (typeof uploadSessionStatuses)[number];

export interface MediaUploadSessionDocument extends Document<string> {
  _id: string;
  userId: string;
  category: MediaCategory;
  expectedContentType: string;
  expectedBytes: number;
  ownerType: string;
  ownerId: string;
  bucket: "staging";
  stagingKey: string;
  status: UploadSessionStatus;
  expiresAt: Date;
  completedAt?: Date;
  mediaId?: string;
  attempts: number;
  /** Whether this session still holds bytes in the reservation counter. */
  quotaReserved?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mediaUploadSessionSchema = new Schema<MediaUploadSessionDocument>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    category: { type: String, enum: mediaCategories, required: true },
    expectedContentType: { type: String, required: true },
    expectedBytes: { type: Number, required: true, min: 1 },
    ownerType: { type: String, required: true },
    ownerId: { type: String, required: true },
    bucket: { type: String, enum: ["staging"], required: true, default: "staging" },
    stagingKey: { type: String, required: true },
    status: { type: String, enum: uploadSessionStatuses, required: true, default: "PENDING" },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
    mediaId: { type: String },
    attempts: { type: Number, required: true, default: 0 },
    quotaReserved: { type: Boolean, default: true }
  },
  { timestamps: true, _id: false }
);

mediaUploadSessionSchema.index({ userId: 1, status: 1 });
mediaUploadSessionSchema.index({ expiresAt: 1 });

export const MediaUploadSession = mongoose.model<MediaUploadSessionDocument>("MediaUploadSession", mediaUploadSessionSchema);
