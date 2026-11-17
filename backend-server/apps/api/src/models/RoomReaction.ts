import mongoose, { Schema, type Document } from "mongoose";

export type RoomReactionAccess = "EVERYONE" | "VIP_EXCLUSIVE";
export type RoomReactionAssetKind = "STATIC" | "ANIMATED";

export interface RoomReactionDocument extends Document<string> {
  label: string;
  emoji?: string;
  assetUrl?: string;
  assetStorageKey?: string;
  assetKind: RoomReactionAssetKind;
  mimeType?: string;
  access: RoomReactionAccess;
  isActive: boolean;
  sortOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roomReactionSchema = new Schema<RoomReactionDocument>(
  {
    _id: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    emoji: { type: String, trim: true, maxlength: 16, default: "" },
    assetUrl: { type: String, trim: true, maxlength: 1000 },
    assetStorageKey: { type: String, trim: true, maxlength: 500 },
    assetKind: { type: String, enum: ["STATIC", "ANIMATED"], default: "STATIC" },
    mimeType: { type: String, trim: true, maxlength: 120 },
    access: { type: String, enum: ["EVERYONE", "VIP_EXCLUSIVE"], default: "EVERYONE", index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser" }
  },
  { timestamps: true, _id: false }
);

roomReactionSchema.index({ isActive: 1, sortOrder: 1, createdAt: 1 });

export const RoomReaction = mongoose.model<RoomReactionDocument>("RoomReaction", roomReactionSchema);
