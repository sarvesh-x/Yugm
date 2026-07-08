import mongoose, { Schema } from "mongoose";

const clanSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 48 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 220 },
    avatar: String,
    privacy: { type: String, enum: ["PUBLIC", "PRIVATE"], default: "PUBLIC", index: true },
    familyLabel: { type: String, trim: true, maxlength: 32, default: "Family" },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    memberCount: { type: Number, default: 1 }
  },
  { timestamps: true }
);

clanSchema.index({ name: "text", description: "text" });

export const Clan = mongoose.model("Clan", clanSchema);
