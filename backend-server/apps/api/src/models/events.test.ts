import assert from "node:assert/strict";
import test from "node:test";
import { Event } from "../models/Event.js";

const createPayload = {
  title: "Diwali Night Jam",
  description: "Live music and sparkle.",
  category: "Music",
  type: "PARTY",
  eventDate: "2026-12-25T18:00:00.000Z",
  timezone: "Asia/Kolkata",
  maxParticipants: 100,
  tags: ["diwali", "music"],
  festival: "diwali",
  featured: true,
};

test("Event model has festival field with correct enum", () => {
  const paths = Object.keys(Event.schema.paths);
  assert.ok(paths.includes("festival"));
  assert.ok(paths.includes("featured"));
  const enumValues = Event.schema.path("festival")?.options?.enum;
  assert.deepEqual(enumValues, ["none", "diwali", "holi", "new_year", "valentines", "independence_day"]);
});

test("Event model festival defaults to none", () => {
  const event = new Event({ title: "Test", hostId: "507f1f77bcf86cd799439013", category: "X", type: "PARTY", eventDate: new Date() });
  assert.equal(event.festival, "none");
  assert.equal(event.featured, false);
});

test("Event model has combined festival index", () => {
  const indexes = Event.schema.indexes();
  const hasFestivalIndex = indexes.some(([key]) => "festival" in key && "status" in key && "eventDate" in key);
  assert.ok(hasFestivalIndex);
});

test("Event model accepts valid festival value", () => {
  const event = new Event({ ...createPayload, hostId: "507f1f77bcf86cd799439013", eventDate: new Date(createPayload.eventDate) });
  assert.equal(event.festival, "diwali");
  assert.equal(event.featured, true);
});

test("Event model validates festival enum on validateSync", () => {
  const event = new Event({ ...createPayload, hostId: "507f1f77bcf86cd799439013", eventDate: new Date(), festival: "eid" });
  assert.ok(event.validateSync() != null);
});

test("Event model rejects invalid type value", () => {
  const event = new Event({ ...createPayload, hostId: "507f1f77bcf86cd799439013", eventDate: new Date(), type: "VOICE" });
  assert.ok(event.validateSync() != null);
});

test("Event model accepts all valid types", () => {
  for (const type of ["ROOM", "TOURNAMENT", "SPECIAL", "WORKSHOP", "PARTY"]) {
    const event = new Event({ ...createPayload, hostId: "507f1f77bcf86cd799439013", eventDate: new Date(), type });
    assert.ok(event.validateSync() == null);
  }
});

test("Event model validates maxParticipants is positive", () => {
  const event = new Event({ ...createPayload, hostId: "507f1f77bcf86cd799439013", eventDate: new Date(), maxParticipants: 0 });
  assert.ok(event.validateSync() != null);
});

test("Event model trims whitespace and rejects overlong title on validation", () => {
  const event = new Event({ title: "  x  ".repeat(30), hostId: "507f1f77bcf86cd799439013", category: "X", type: "PARTY", eventDate: new Date() });
  const err = event.validateSync();
  assert.ok(err != null);
  assert.equal(event.title, event.title.trim());
  assert.ok(event.title.length <= 120 || err.errors.title != null);
});
test("Event model defaults status to UPCOMING", () => {
  const event = new Event({ title: "Test", hostId: "507f1f77bcf86cd799439013", category: "X", type: "PARTY", eventDate: new Date() });
  assert.equal(event.status, "UPCOMING");
});

test("Event model has timestamps", () => {
  assert.ok(Event.schema.options.timestamps);
});
