import assert from "node:assert/strict";
import test from "node:test";
import { SupportTicket } from "../models/SupportTicket.js";

test("SupportTicket model has correct schema fields", () => {
  const paths = Object.keys(SupportTicket.schema.paths);
  assert.ok(paths.includes("userId"));
  assert.ok(paths.includes("subject"));
  assert.ok(paths.includes("message"));
  assert.ok(paths.includes("status"));
  assert.ok(paths.includes("priority"));
  assert.ok(paths.includes("category"));
  assert.ok(paths.includes("messages"));
  assert.ok(paths.includes("lastMessageAt"));
  assert.ok(paths.includes("closedAt"));
  assert.ok(paths.includes("resolvedAt"));
});

test("SupportTicket status enum values", () => {
  const enumValues = SupportTicket.schema.path("status")?.options?.enum;
  assert.deepEqual(enumValues, ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
});

test("SupportTicket priority enum values", () => {
  const enumValues = SupportTicket.schema.path("priority")?.options?.enum;
  assert.deepEqual(enumValues, ["LOW", "MEDIUM", "HIGH", "URGENT"]);
});

test("SupportTicket category enum values", () => {
  const enumValues = SupportTicket.schema.path("category")?.options?.enum;
  assert.deepEqual(enumValues, ["General", "Account", "Payment", "Technical", "Report", "Content", "Other"]);
});
