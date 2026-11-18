import mongoose, { Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const bondSchema = new Schema({
  pairKey: { type: String, required: true },
  users: { type: [objectId], required: true },
  slots: { type: [Number], required: true },
  kind: { type: String, required: true },
  status: { type: String, enum: ["ACTIVE", "ENDED", "TERMINATED_BY_BLOCK", "TERMINATED_BY_MODERATION", "TERMINATED_BY_ACCOUNT_REMOVAL"], default: "ACTIVE" },
  activatedAt: { type: Date, required: true },
  endedAt: Date,
  endedBy: objectId,
  points: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
  milestoneDays: { type: [Number], default: [] },
  nextMilestoneAt: Date,
  anniversaryReminderAt: Date,
  preferences: { type: Map, of: new Schema({
    visibility: { type: String, enum: ["PRIVATE", "FRIENDS", "PUBLIC"], default: "PRIVATE" },
    showDuration: { type: Boolean, default: true },
    showLevel: { type: Boolean, default: true },
    showBadge: { type: Boolean, default: true },
    leaderboard: { type: Boolean, default: false },
    showRanking: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true },
    announcements: { type: Boolean, default: false }
  }, { _id: false }), default: {} }
}, { timestamps: true });

bondSchema.index({ pairKey: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });
bondSchema.index({ users: 1, status: 1, activatedAt: -1 });
bondSchema.index({ status: 1, nextMilestoneAt: 1 });
bondSchema.index({ status: 1, anniversaryReminderAt: 1 });

const requestSchema = new Schema({
  pairKey: { type: String, required: true },
  senderId: { type: objectId, required: true },
  recipientId: { type: objectId, required: true },
  kind: { type: String, required: true },
  bondId: objectId,
  slot: Number,
  giftId: objectId,
  giftName: String,
  giftIcon: String,
  price: { type: Number, default: 0 },
  giftPoints: { type: Number, default: 0 },
  message: String,
  status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "INVALIDATED"], default: "PENDING" },
  expiresAt: { type: Date, required: true },
  resolvedAt: Date,
  key: { type: String, required: true },
  version: { type: Number, default: 1 }
}, { timestamps: true });

requestSchema.index({ pairKey: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" } });
requestSchema.index({ senderId: 1, key: 1 }, { unique: true });
requestSchema.index({ senderId: 1, status: 1, expiresAt: 1 });
requestSchema.index({ recipientId: 1, status: 1, expiresAt: 1 });
requestSchema.index({ status: 1, expiresAt: 1 });

const pointSchema = new Schema({
  bondId: { type: objectId, required: true },
  actorId: objectId,
  key: { type: String, required: true },
  kind: { type: String, required: true },
  points: { type: Number, required: true },
  support: { type: Number, default: 0 }
}, { timestamps: { createdAt: true, updatedAt: false } });
pointSchema.index({ bondId: 1, key: 1 }, { unique: true });
pointSchema.index({ createdAt: 1, kind: 1 });

const snapshotSchema = new Schema({
  period: { type: String, required: true },
  category: { type: String, required: true },
  entries: { type: [{ _id: false, bondId: objectId, score: Number, rank: Number }], required: true },
  finalizedAt: { type: Date, required: true }
});
snapshotSchema.index({ period: 1, category: 1 }, { unique: true });

const rewardSchema = new Schema({
  bondId: { type: objectId, required: true },
  userId: { type: objectId, required: true },
  key: { type: String, required: true },
  itemId: { type: String, required: true },
  grantedAt: { type: Date, required: true },
  expiresAt: Date,
  expiredAt: Date
});
rewardSchema.index({ bondId: 1, userId: 1, key: 1 }, { unique: true });
rewardSchema.index({ expiredAt: 1, expiresAt: 1 });
rewardSchema.index({ userId: 1, itemId: 1, expiredAt: 1 });

export const Bond = mongoose.model("Bond", bondSchema);
export const BondRequest = mongoose.model("BondRequest", requestSchema);
export const BondPoint = mongoose.model("BondPoint", pointSchema);
export const BondRankingSnapshot = mongoose.model("BondRankingSnapshot", snapshotSchema);
export const BondReward = mongoose.model("BondReward", rewardSchema);
export type BondRecord = Omit<mongoose.InferSchemaType<typeof bondSchema>, "preferences"> & {
  _id: mongoose.Types.ObjectId;
  preferences?: unknown;
};
export type BondRequestRecord = mongoose.InferSchemaType<typeof requestSchema> & { _id: mongoose.Types.ObjectId };

