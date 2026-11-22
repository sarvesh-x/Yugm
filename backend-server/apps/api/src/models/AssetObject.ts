import mongoose, { Schema, type Document } from "mongoose";

export const assetOwners = ["cosmetic", "badge", "gift"] as const;
export type AssetOwner = (typeof assetOwners)[number];

export const assetStatuses = ["staging", "published", "archived"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export interface AssetVariant {
  name: string;
  key: string;
  url: string;
  contentType: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface AssetDocument extends Document<string> {
  _id: string;
  ownerType: AssetOwner;
  ownerId: string;
  kind: "IMAGE";
  status: AssetStatus;
  version: number;
  originalName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  stagingKey: string;
  stagingUrl: string;
  publicKey?: string;
  publicUrl?: string;
  variants: AssetVariant[];
  createdBy: string;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<AssetVariant>(
  {
    name: { type: String, required: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    contentType: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number }
  },
  { _id: false }
);

const assetObjectSchema = new Schema<AssetDocument>(
  {
    _id: { type: String, required: true },
    ownerType: { type: String, enum: assetOwners, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    kind: { type: String, enum: ["IMAGE"], default: "IMAGE" },
    status: { type: String, enum: assetStatuses, required: true, default: "staging", index: true },
    version: { type: Number, required: true, min: 1 },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true },
    stagingKey: { type: String, required: true },
    stagingUrl: { type: String, required: true },
    publicKey: { type: String },
    publicUrl: { type: String },
    variants: { type: [variantSchema], default: [] },
    createdBy: { type: String, required: true },
    publishedAt: { type: Date },
    archivedAt: { type: Date }
  },
  { timestamps: true, _id: false }
);

// Names match migration v6. Without them Mongoose autoIndex can create the
// same keys under default names and make the additive migration fail with
// IndexOptionsConflict on a fresh deployment.
assetObjectSchema.index({ ownerType: 1, ownerId: 1, version: 1 }, { unique: true, name: "asset_owner_version" });
assetObjectSchema.index({ ownerType: 1, ownerId: 1, sha256: 1 }, { name: "asset_owner_sha256" });
assetObjectSchema.index({ status: 1, createdAt: -1 }, { name: "asset_status_created" });

export const AssetObject = mongoose.model<AssetDocument>("AssetObject", assetObjectSchema);
