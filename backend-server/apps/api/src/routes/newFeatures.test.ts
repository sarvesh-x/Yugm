import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

// Story creation schema validation
const createStorySchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  caption: z.string().max(200).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  font: z.string().optional(),
  sticker: z.string().optional(),
  linkUrl: z.string().url().optional().or(z.literal(""))
});

test("Story creation schema validates correct input", () => {
  const result = createStorySchema.safeParse({
    mediaUrl: "https://example.com/story.jpg",
    mediaType: "IMAGE"
  });
  assert.ok(result.success);
});

test("Story creation schema rejects missing mediaUrl", () => {
  const result = createStorySchema.safeParse({ mediaType: "IMAGE" });
  assert.ok(!result.success);
});

test("Story creation schema rejects invalid mediaType", () => {
  const result = createStorySchema.safeParse({
    mediaUrl: "https://example.com/story.jpg",
    mediaType: "AUDIO"
  });
  assert.ok(!result.success);
});

test("Story creation schema accepts optional fields", () => {
  const result = createStorySchema.safeParse({
    mediaUrl: "https://example.com/story.jpg",
    mediaType: "IMAGE",
    caption: "My story",
    backgroundColor: "#ff0000",
    sticker: "party"
  });
  assert.ok(result.success);
});

test("Story creation schema rejects caption over 200 chars", () => {
  const result = createStorySchema.safeParse({
    mediaUrl: "https://example.com/story.jpg",
    mediaType: "IMAGE",
    caption: "x".repeat(201)
  });
  assert.ok(!result.success);
});

// Event creation schema validation
const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  coverImage: z.string().optional(),
  category: z.string().min(1),
  type: z.enum(["ROOM", "TOURNAMENT", "SPECIAL", "WORKSHOP", "PARTY"]),
  eventDate: z.coerce.date(),
  eventEndDate: z.coerce.date().optional(),
  timezone: z.string().optional(),
  roomId: z.string().optional(),
  maxParticipants: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional()
});

test("Event creation schema validates correct input", () => {
  const result = createEventSchema.safeParse({
    title: "Music Night",
    category: "Music",
    type: "PARTY",
    eventDate: new Date(Date.now() + 86400000).toISOString()
  });
  assert.ok(result.success);
});

test("Event creation schema rejects short title", () => {
  const result = createEventSchema.safeParse({
    title: "AB",
    category: "Music",
    type: "PARTY",
    eventDate: new Date(Date.now() + 86400000).toISOString()
  });
  assert.ok(!result.success);
});

test("Event creation schema rejects invalid type", () => {
  const result = createEventSchema.safeParse({
    title: "Music Night",
    category: "Music",
    type: "CONCERT",
    eventDate: new Date(Date.now() + 86400000).toISOString()
  });
  assert.ok(!result.success);
});

test("Event creation schema rejects missing category", () => {
  const result = createEventSchema.safeParse({
    title: "Music Night",
    type: "PARTY",
    eventDate: new Date(Date.now() + 86400000).toISOString()
  });
  assert.ok(!result.success);
});

test("Event creation schema accepts all optional fields", () => {
  const result = createEventSchema.safeParse({
    title: "Big Tournament",
    category: "Gaming",
    type: "TOURNAMENT",
    eventDate: new Date(Date.now() + 86400000).toISOString(),
    description: "A big gaming tournament",
    maxParticipants: 50,
    tags: ["gaming", "competitive"]
  });
  assert.ok(result.success);
});

test("Event creation schema rejects negative maxParticipants", () => {
  const result = createEventSchema.safeParse({
    title: "Music Night",
    category: "Music",
    type: "PARTY",
    eventDate: new Date(Date.now() + 86400000).toISOString(),
    maxParticipants: -1
  });
  assert.ok(!result.success);
});

// Referral claim schema validation
const claimReferralSchema = z.object({ code: z.string().min(4).max(20) });

test("Referral claim schema validates correct code", () => {
  const result = claimReferralSchema.safeParse({ code: "ABC123" });
  assert.ok(result.success);
});

test("Referral claim schema rejects short code", () => {
  const result = claimReferralSchema.safeParse({ code: "AB" });
  assert.ok(!result.success);
});

test("Referral claim schema rejects missing code", () => {
  const result = claimReferralSchema.safeParse({});
  assert.ok(!result.success);
});

// Clan message schema validation
const clanMessageSchema = z.object({ message: z.string().min(1).max(600) });

test("Clan message schema validates correct input", () => {
  const result = clanMessageSchema.safeParse({ message: "Hello clan!" });
  assert.ok(result.success);
});

test("Clan message schema rejects empty message", () => {
  const result = clanMessageSchema.safeParse({ message: "" });
  assert.ok(!result.success);
});

test("Clan message schema rejects overlong message", () => {
  const result = clanMessageSchema.safeParse({ message: "x".repeat(601) });
  assert.ok(!result.success);
});
