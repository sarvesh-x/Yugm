import mongoose, { Schema, type Document } from "mongoose";
import { mediaCategories, mediaOwnerTypes, r2Buckets, type MediaCategory, type MediaOwnerType, type R2Bucket } from "../services/r2.js";

export const mediaVisibilities = ["PUBLIC", "PRIVATE"] as const;
export type MediaVisibility = (typeof mediaVisibilities)[number];

export const processingStatuses = ["PENDING", "PROCESSING", "READY", "FAILED"] as const;
export type ProcessingStatus = (typeof processingStatuses)[number];

export const moderationStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export interface MediaVariant {
  name: string;
  bucket: R2Bucket;
  key: string;
  url?: string;
  contentType: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface MediaDocument extends Document<string> {
  _id: string;
  ownerType: MediaOwnerType;
  ownerId: string;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "FILE";
  category: MediaCategory;
  bucket: R2Bucket;
  storageKey: string;
  contentType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  checksum: string;
  visibility: MediaVisibility;
  processingStatus: ProcessingStatus;
  moderationStatus: ModerationStatus;
  version: number;
  variants: MediaVariant[];
  createdBy: string;
  supersededById?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<MediaVariant>(
  {
    name: { type: String, required: true },
    bucket: { type: String, enum: r2Buckets, required: true },
    key: { type: String, required: true },
    url: { type: String },
    contentType: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number }
  },
  { _id: false }
);

const mediaObjectSchema = new Schema<MediaDocument>(
  {
    _id: { type: String, required: true },
    ownerType: { type: String, enum: mediaOwnerTypes, required: true },
    ownerId: { type: String, required: true },
    mediaType: { type: String, enum: ["IMAGE", "VIDEO", "AUDIO", "FILE"], required: true },
    category: { type: String, enum: mediaCategories, required: true },
    bucket: { type: String, enum: r2Buckets, required: true },
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 1 },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    checksum: { type: String, required: true },
    visibility: { type: String, enum: mediaVisibilities, required: true },
    processingStatus: { type: String, enum: processingStatuses, required: true, default: "PENDING" },
    moderationStatus: { type: String, enum: moderationStatuses, required: true, default: "PENDING" },
    version: { type: Number, required: true, min: 1 },
    variants: { type: [variantSchema], default: [] },
    createdBy: { type: String, required: true },
    supersededById: { type: String },
    deletedAt: { type: Date }
  },
  { timestamps: true, _id: false }
);

mediaObjectSchema.index({ ownerType: 1, ownerId: 1, category: 1, version: 1 }, { unique: true });
mediaObjectSchema.index({ checksum: 1 });
mediaObjectSchema.index({ visibility: 1, processingStatus: 1 });
mediaObjectSchema.index({ deletedAt: 1 });

export const MediaObject = mongoose.model<MediaDocument>("MediaObject", mediaObjectSchema);
