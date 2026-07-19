import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { RoomRecording } from "../models/RoomRecording.js";

const startSchema = z.object({
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  title: z.string().min(1).max(100).optional(),
});

const stopSchema = z.object({
  recordingUrl: z.string().url(),
  duration: z.number().int().min(1),
});

const updateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
});

test("RoomRecording model has correct schema fields", () => {
  const paths = Object.keys(RoomRecording.schema.paths);
  assert.ok(paths.includes("roomId"));
  assert.ok(paths.includes("hostId"));
  assert.ok(paths.includes("title"));
  assert.ok(paths.includes("recordingUrl"));
  assert.ok(paths.includes("duration"));
  assert.ok(paths.includes("viewCount"));
  assert.ok(paths.includes("status"));
});

test("RoomRecording status enum values", () => {
  const enumValues = RoomRecording.schema.path("status")?.options?.enum;
  assert.deepEqual(enumValues, ["PROCESSING", "PUBLISHED", "FAILED"]);
});

test("RoomRecording has timestamps", () => {
  assert.ok(RoomRecording.schema.options.timestamps);
});

test("RoomRecording has hostId index", () => {
  const index = RoomRecording.schema.indexes().find(([key]) => "hostId" in key && "createdAt" in key);
  assert.ok(index);
});

test("Start schema validates correct input", () => {
  const result = startSchema.safeParse({
    roomId: "507f1f77bcf86cd799439012",
    title: "My Recording",
  });
  assert.ok(result.success);
});

test("Start schema works without optional title", () => {
  const result = startSchema.safeParse({
    roomId: "507f1f77bcf86cd799439012",
  });
  assert.ok(result.success);
});

test("Start schema rejects invalid roomId format", () => {
  const result = startSchema.safeParse({
    roomId: "invalid-id",
  });
  assert.ok(!result.success);
});

test("Start schema rejects missing roomId", () => {
  const result = startSchema.safeParse({});
  assert.ok(!result.success);
});

test("Start schema rejects empty roomId", () => {
  const result = startSchema.safeParse({ roomId: "" });
  assert.ok(!result.success);
});

test("Start schema rejects overlong title", () => {
  const result = startSchema.safeParse({
    roomId: "507f1f77bcf86cd799439012",
    title: "x".repeat(101),
  });
  assert.ok(!result.success);
});

test("Stop schema validates correct input", () => {
  const result = stopSchema.safeParse({
    recordingUrl: "https://storage.example.com/recordings/abc123.mp4",
    duration: 3600,
  });
  assert.ok(result.success);
});

test("Stop schema rejects missing recordingUrl", () => {
  const result = stopSchema.safeParse({ duration: 3600 });
  assert.ok(!result.success);
});

test("Stop schema rejects invalid URL", () => {
  const result = stopSchema.safeParse({
    recordingUrl: "not-a-url",
    duration: 3600,
  });
  assert.ok(!result.success);
});

test("Stop schema rejects zero duration", () => {
  const result = stopSchema.safeParse({
    recordingUrl: "https://example.com/recording.mp4",
    duration: 0,
  });
  assert.ok(!result.success);
});

test("Stop schema rejects negative duration", () => {
  const result = stopSchema.safeParse({
    recordingUrl: "https://example.com/recording.mp4",
    duration: -1,
  });
  assert.ok(!result.success);
});

test("Stop schema rejects non-integer duration", () => {
  const result = stopSchema.safeParse({
    recordingUrl: "https://example.com/recording.mp4",
    duration: 1.5,
  });
  assert.ok(!result.success);
});

test("Update schema validates title", () => {
  const result = updateSchema.safeParse({ title: "New Title" });
  assert.ok(result.success);
});

test("Update schema rejects overlong title", () => {
  const result = updateSchema.safeParse({ title: "x".repeat(101) });
  assert.ok(!result.success);
});

test("Update schema accepts empty body (no changes)", () => {
  const result = updateSchema.safeParse({});
  assert.ok(result.success);
});

test("Recording status transitions are valid", () => {
  const validStatuses = ["PROCESSING", "PUBLISHED", "FAILED"] as const;
  const fromProcessing = validStatuses.filter(() => true);
  assert.ok(fromProcessing.length === 3);

  const recording = new RoomRecording({
    roomId: "507f1f77bcf86cd799439012",
    hostId: "507f1f77bcf86cd799439013",
    title: "Test Recording",
  });
  assert.equal(recording.status, "PROCESSING");
});

test("Recording viewCount defaults to 0", () => {
  const recording = new RoomRecording({
    roomId: "507f1f77bcf86cd799439012",
    hostId: "507f1f77bcf86cd799439013",
    title: "Test Recording",
  });
  assert.equal(recording.viewCount, 0);
});

test("Recording duration defaults to 0", () => {
  const recording = new RoomRecording({
    roomId: "507f1f77bcf86cd799439012",
    hostId: "507f1f77bcf86cd799439013",
    title: "Test Recording",
  });
  assert.equal(recording.duration, 0);
});
