import assert from "node:assert/strict";
import test from "node:test";
import { ErrorCode, HttpError, isValidObjectId, sanitizeText } from "./http.js";

test("HttpError creates error with correct properties", () => {
  const err = new HttpError(400, "Bad request", ErrorCode.VALIDATION);
  assert.equal(err.status, 400);
  assert.equal(err.message, "Bad request");
  assert.equal(err.code, ErrorCode.VALIDATION);
  assert.equal(err.name, "HttpError");
});

test("HttpError defaults code to undefined", () => {
  const err = new HttpError(500, "Server error");
  assert.equal(err.status, 500);
  assert.equal(err.message, "Server error");
  assert.equal(err.code, undefined);
});

test("isValidObjectId returns true for valid 24-char hex string", () => {
  assert.ok(isValidObjectId("507f1f77bcf86cd799439011"));
  assert.ok(isValidObjectId("000000000000000000000000"));
  assert.ok(isValidObjectId("ffffffffffffffffffffffff"));
});

test("isValidObjectId returns false for invalid strings", () => {
  assert.ok(!isValidObjectId(""));
  assert.ok(!isValidObjectId("short"));
  assert.ok(!isValidObjectId("507f1f77bcf86cd79943901z"));
  assert.ok(!isValidObjectId("507f1f77bcf86cd7994390111"));
  assert.ok(!isValidObjectId(null as unknown as string));
});

test("sanitizeText removes HTML special characters", () => {
  assert.equal(sanitizeText("<script>alert('xss')</script>"), "scriptalert(xss)/script");
  assert.equal(sanitizeText("<b>bold</b>"), "bbold/b");
  assert.equal(sanitizeText('quote"test'), "quotetest");
});

test("sanitizeText trims whitespace", () => {
  assert.equal(sanitizeText("  hello  "), "hello");
});

test("sanitizeText truncates to 500 characters", () => {
  const long = "a".repeat(1000);
  assert.equal(sanitizeText(long).length, 500);
});

test("sanitizeText handles empty string", () => {
  assert.equal(sanitizeText(""), "");
});
