import { z } from "zod";

export const appName = "Yugm";
export const tagline = "Match the vibe.";

export const roles = ["USER", "HOST", "MODERATOR", "ADMIN"] as const;
export const roomTypes = ["VOICE", "VIDEO"] as const;
export const roomStatuses = ["LIVE", "ENDED", "SCHEDULED"] as const;
export const roomVisibilities = ["PUBLIC", "PRIVATE"] as const;
export const roomParticipantRoles = ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"] as const;
export const reactionTypes = ["heart", "fire", "laugh", "clap", "wow"] as const;

export type UserRole = (typeof roles)[number];
export type RoomType = (typeof roomTypes)[number];
export type RoomStatus = (typeof roomStatuses)[number];
export type RoomVisibility = (typeof roomVisibilities)[number];
export type RoomParticipantRole = (typeof roomParticipantRoles)[number];
export type ReactionType = (typeof reactionTypes)[number];

export const socketEvents = {
  roomJoin: "room:join",
  roomLeave: "room:leave",
  roomParticipantUpdate: "room:participant:update",
  roomChatMessage: "room:chat:message",
  roomGiftSend: "room:gift:send",
  roomReactionSend: "room:reaction:send",
  roomActivityNew: "room:activity:new",
  roomPollNew: "room:poll:new",
  roomPollVote: "room:poll:vote",
  roomSpeakerRequest: "room:speaker:request",
  roomSpeakerApprove: "room:speaker:approve",
  roomSpeakerReject: "room:speaker:reject",
  roomUserMute: "room:user:mute",
  roomUserRemove: "room:user:remove",
  roomEnded: "room:ended",
  userOnline: "user:online",
  userOffline: "user:offline",
  notificationNew: "notification:new"
} as const;

export const giftCatalogSeed = [
  { name: "Rose", icon: "rose", coinPrice: 10 },
  { name: "Diya", icon: "diya", coinPrice: 50 },
  { name: "Lotus", icon: "lotus", coinPrice: 100 },
  { name: "Crown", icon: "crown", coinPrice: 500 },
  { name: "Astra", icon: "astra", coinPrice: 1000 }
] as const;

export const coinPacks = [
  { id: "coins_990", coinAmount: 990, priceInr: 99, googleProductId: "yugm_coins_990" },
  { id: "coins_1990", coinAmount: 1990, priceInr: 199, googleProductId: "yugm_coins_1990" },
  { id: "coins_4990", coinAmount: 4990, priceInr: 499, googleProductId: "yugm_coins_4990" }
] as const;

export const categories = [
  "Trending",
  "Nearby",
  "Voice",
  "Video",
  "Music",
  "Gaming",
  "Chill",
  "Dating",
  "Friends"
] as const;

const otpContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).max(16).optional()
});

export const requestOtpSchema = otpContactSchema.refine((value) => value.email || value.phone, "Email or phone is required");

export const verifyOtpSchema = otpContactSchema.extend({
  otp: z.string().min(4).max(8)
}).refine((value) => value.email || value.phone, "Email or phone is required");

export const profileSchema = z.object({
  name: z.string().min(2).max(60),
  username: z.string().min(3).max(24).regex(/^[a-z0-9_.]+$/i),
  gender: z.string().max(32).optional(),
  age: z.number().int().min(18).max(80).optional(),
  city: z.string().max(60).optional(),
  bio: z.string().max(180).optional(),
  interests: z.array(z.string().min(1).max(24)).default([]),
  languages: z.array(z.string().min(1).max(24)).default(["Hindi", "English"]),
  avatar: z.string().url().optional()
});

export const createRoomSchema = z.object({
  type: z.enum(roomTypes),
  title: z.string().min(3).max(80),
  description: z.string().max(240).optional(),
  tags: z.array(z.string().min(1).max(24)).max(8).default([]),
  language: z.string().min(2).max(32),
  category: z.string().min(2).max(32),
  maxSpeakers: z.number().int().min(1).max(12).default(6),
  visibility: z.enum(roomVisibilities).default("PUBLIC"),
  coverImage: z.string().optional(),
  allowAudienceMicRequests: z.boolean().default(true),
  scheduledFor: z.string().datetime().optional()
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(500)
});

export const reportSchema = z.object({
  targetUserId: z.string().optional(),
  roomId: z.string().optional(),
  reason: z.string().min(2).max(80),
  description: z.string().max(500).optional()
});

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const sendGiftSchema = z.object({
  giftId: z.string().regex(objectIdPattern, "Invalid giftId format"),
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format")
});

export const createPurchaseOrderSchema = z.object({
  packId: z.string(),
  provider: z.enum(["RAZORPAY", "GOOGLE_PLAY"])
});

export const verifyRazorpayPurchaseSchema = z.object({
  purchaseId: z.string().regex(objectIdPattern, "Invalid purchaseId format"),
  razorpay_order_id: z.string().min(3),
  razorpay_payment_id: z.string().min(3),
  razorpay_signature: z.string().min(16)
});

export const verifyGooglePlayPurchaseSchema = z.object({
  packId: z.string(),
  productId: z.string().min(3),
  purchaseToken: z.string().min(10),
  orderId: z.string().optional()
});

export const reactionSchema = z.object({
  type: z.enum(reactionTypes)
});

export const createPollSchema = z.object({
  question: z.string().min(3).max(120),
  options: z.array(z.string().min(1).max(40)).min(2).max(4)
});

export const votePollSchema = z.object({
  optionIndex: z.number().int().min(0).max(3)
});

export const inviteSchema = z.object({
  userId: z.string().regex(objectIdPattern, "Invalid userId format")
});

export const directMessageSchema = z.object({
  message: z.string().min(1).max(500),
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format").optional()
});

export const livekitTokenSchema = z.object({
  roomId: z.string(),
  role: z.enum(roomParticipantRoles).optional()
});
