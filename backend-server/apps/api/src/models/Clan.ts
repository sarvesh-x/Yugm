import mongoose, { Schema } from "mongoose";

export const CLAN_ROLES = ["LEADER", "CO_LEADER", "OFFICER", "MEMBER"] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

const clanMemberRoleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: CLAN_ROLES, default: "MEMBER" }
  },
  { _id: false }
);

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
    memberRoles: { type: [clanMemberRoleSchema], default: [] },
    memberCount: { type: Number, default: 1 }
  },
  { timestamps: true }
);

clanSchema.index({ name: "text", description: "text" });
clanSchema.index({ "memberRoles.userId": 1 });

export const Clan = mongoose.model("Clan", clanSchema);
