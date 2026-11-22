import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const USER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";
const ADMIN = "507f1f77bcf86cd799439013";
const REPORT = "507f1f77bcf86cd799439014";
const ROOM = "507f1f77bcf86cd799439015";
const VERIFICATION = "507f1f77bcf86cd799439016";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-moderation");
  const result = applyMapping(collection, record, context);
  context.assertAccountedFor();
  return { context, result };
}

function table(result: { writes: Array<{ table: string; rows: TargetRow[] }> }, name: string): TargetRow[] {
  return result.writes.find((write) => write.table === name)?.rows ?? [];
}

function assertColumns(result: { writes: Array<{ table: string; rows: TargetRow[] }> }) {
  for (const write of result.writes) {
    for (const row of write.rows) {
      for (const key of Object.keys(row)) {
        assert.match(key, /^[A-Za-z_][A-Za-z0-9_]*$/, `${write.table}.${key}`);
      }
    }
  }
}

test("reports canonicalize evidence and preserve moderation review state", () => {
  const { result } = map("reports", {
    _id: REPORT, reporterId: USER, targetUserId: OTHER, roomId: ROOM,
    reason: "spam", description: "Repeated links", evidence: { z: 2, a: 1 },
    riskScore: 75, autoFlagged: true, status: "REVIEWED",
    reviewedBy: ADMIN, reviewedAt: "2026-01-03T00:00:00Z", createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "reports")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.reporter_id, USER);
  assert.equal(row.target_user_id, OTHER);
  assert.equal(row.room_id, ROOM);
  assert.equal(row.evidence, '{"a":1,"z":2}');
  assert.equal(row.risk_score, 75);
  assert.equal(row.auto_flagged, 1);
  assert.equal(row.status, "REVIEWED");
  assert.equal(row.reviewed_by, ADMIN);
  assertColumns(result);

  const bad = map("reports", { _id: REPORT, reporterId: USER, reason: "spam", status: "CLOSED" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("moderation queues keep target, priority and assignment references", () => {
  const { result } = map("moderation_queues", {
    _id: REPORT, reportId: REPORT, targetType: "VOICE_ROOM", targetId: ROOM,
    targetUserId: OTHER, priority: "CRITICAL", status: "IN_REVIEW",
    assignedTo: ADMIN, reason: "live report", aiScore: 90, notes: "watching",
    resolvedAt: "2026-01-04T00:00:00Z", resolvedBy: ADMIN, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "moderation_queues")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.report_id, REPORT);
  assert.equal(row.target_type, "VOICE_ROOM");
  assert.equal(row.target_id, ROOM);
  assert.equal(row.priority, "CRITICAL");
  assert.equal(row.status, "IN_REVIEW");
  assert.equal(row.assigned_to, ADMIN);
  assert.equal(row.resolved_by, ADMIN);
  assertColumns(result);

  const bad = map("moderation_queues", { _id: REPORT, targetType: "POST", targetId: ROOM });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("moderation actions keep enforcement bounds and automated flag", () => {
  const { result } = map("moderation_actions", {
    _id: REPORT, targetUserId: USER, moderatorId: ADMIN, reportId: REPORT,
    action: "SUSPEND", reason: "policy", durationHours: 24,
    expiresAt: "2026-01-26T00:00:00Z", automated: false, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "moderation_actions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.action, "SUSPEND");
  assert.equal(row.duration_hours, 24);
  assert.equal(row.automated, 0);
  assert.equal(row.expires_at, "2026-01-26T00:00:00.000Z");
  assertColumns(result);

  const bad = map("moderation_actions", { _id: REPORT, targetUserId: USER, action: "DELETE", reason: "x" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("admin audit logs preserve append-only metadata and request context", () => {
  const { result } = map("admin_audit_logs", {
    _id: REPORT, adminId: ADMIN, action: "USER_UPDATE", entityType: "User", entityId: USER,
    targetUserId: USER, metadata: { before: "USER", after: "MODERATOR" },
    ipAddress: "203.0.113.10", userAgent: "admin", createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "admin_audit_logs")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.admin_id, ADMIN);
  assert.equal(row.entity_type, "User");
  assert.equal(row.entity_id, USER);
  assert.equal(row.metadata, '{"after":"MODERATOR","before":"USER"}');
  assert.equal(row.ip_address, "203.0.113.10");
  assert.equal(row.user_agent, "admin");
  assertColumns(result);
});

test("admin moderation actions keep the full 17-value action allowlist", () => {
  const { result } = map("admin_moderation_actions", {
    _id: REPORT, adminId: ADMIN, queueId: REPORT, reportId: REPORT,
    targetType: "USER", targetId: USER, targetUserId: USER,
    actionType: "WITHDRAWAL_REJECTED", reason: "duplicate", durationHours: 0,
    metadata: { source: "admin" }, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "admin_moderation_actions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.action_type, "WITHDRAWAL_REJECTED");
  assert.equal(row.duration_hours, 0);
  assert.equal(row.metadata, '{"source":"admin"}');
  assertColumns(result);

  const bad = map("admin_moderation_actions", {
    _id: REPORT, adminId: ADMIN, targetType: "USER", actionType: "DELETE_EVERYTHING"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("support tickets keep defaults and emit deterministic message child rows", () => {
  const { result } = map("support_tickets", {
    _id: REPORT, userId: USER, requesterEmail: "USER@EXAMPLE.COM", assignedTo: ADMIN,
    subject: "Payment help", message: "Charged twice", status: "IN_PROGRESS",
    priority: "HIGH",
    messages: [
      { senderId: USER, senderRole: "USER", message: "Hello", createdAt: "2026-01-02T03:04:05Z" },
      { senderId: ADMIN, senderRole: "ADMIN", message: "Checking", createdAt: "2026-01-02T04:00:00Z" },
      { senderId: USER, senderRole: "SYSTEM", message: "Bad role", createdAt: "2026-01-02T03:04:05Z" }
    ],
    lastMessageAt: "2026-01-02T04:00:00Z", createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "support_tickets")[0];
  const messages = table(result, "support_ticket_messages");
  assert.equal(result.rejected, false);
  assert.equal(row.category, "General");
  assert.equal(row.status, "IN_PROGRESS");
  assert.equal(row.priority, "HIGH");
  assert.equal(messages.length, 2);
  assert.equal(messages[0].sender_id, USER);
  assert.equal(messages[0].sender_role, "USER");
  assert.equal(messages[0].created_at, "2026-01-02T03:04:05.000Z");
  assert.equal(messages[0].support_tickets_id, REPORT);
  assert.equal(messages[0].position, 0);
  assert.equal(messages[1].position, 1);
  assertColumns(result);

  const defaults = map("support_tickets", { _id: REPORT, subject: "s", message: "m" });
  assert.equal(defaults.result.rejected, false);
  assert.equal(table(defaults.result, "support_tickets")[0].status, "OPEN");
  assert.equal(table(defaults.result, "support_tickets")[0].priority, "MEDIUM");
});

test("support messages keep attachments JSON and sender provenance", () => {
  const { result } = map("support_messages", {
    _id: REPORT, ticketId: REPORT, senderType: "SYSTEM", senderUserId: USER,
    senderAdminId: ADMIN, message: "Auto reply", attachments: [{ key: "file-1" }],
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "support_messages")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.ticket_id, REPORT);
  assert.equal(row.sender_type, "SYSTEM");
  assert.equal(row.sender_admin_id, ADMIN);
  assert.equal(row.attachments, '[{"key":"file-1"}]');
  assertColumns(result);

  const empty = map("support_messages", { _id: REPORT, ticketId: REPORT, senderType: "USER", message: "x" });
  assert.equal(table(empty.result, "support_messages")[0].attachments, "[]");
});

test("trust verifications keep all status families, flags and consent", () => {
  const { result } = map("trust_verifications", {
    _id: VERIFICATION, userId: USER, status: "PENDING_REVIEW", level: "ADVANCED",
    faceStatus: "VERIFIED", voiceStatus: "SUBMITTED", livenessStatus: "NEEDS_RETRY",
    verificationScore: 82, riskScore: 12, verifiedBadgeEnabled: true, creatorTrustEnabled: false,
    submittedAt: "2026-01-02T00:00:00Z", reviewedAt: "2026-01-03T00:00:00Z",
    verifiedAt: null, rejectedAt: null, reviewedByAdminId: ADMIN,
    rejectionReason: "blurry", adminNotes: "retry", consentVersion: "v2",
    consentAcceptedAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "trust_verifications")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.user_id, USER);
  assert.equal(row.status, "PENDING_REVIEW");
  assert.equal(row.face_status, "VERIFIED");
  assert.equal(row.liveness_status, "NEEDS_RETRY");
  assert.equal(row.verified_badge_enabled, 1);
  assert.equal(row.creator_trust_enabled, 0);
  assert.equal(row.reviewed_by_admin_id, ADMIN);
  assert.equal(row.consent_version, "v2");
  assert.equal(row.verified_at, null);
  assertColumns(result);

  const bad = map("trust_verifications", { _id: VERIFICATION, userId: USER, faceStatus: "UNKNOWN" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("face verification submissions keep media references and provider JSON", () => {
  const { result } = map("face_verification_submissions", {
    _id: REPORT, userId: USER, verificationId: VERIFICATION,
    selfieImageUrl: "https://cdn.test/selfie.png", selfieVideoUrl: null,
    livenessVideoUrl: "https://cdn.test/liveness.mp4", faceMatchScore: 91,
    livenessScore: 88, qualityScore: 95, provider: "test-provider",
    providerReferenceId: "ref-1", providerResponse: { z: 1, a: 2 },
    status: "APPROVED", reviewedAt: "2026-01-03T00:00:00Z", reviewedByAdminId: ADMIN
  });
  const row = table(result, "face_verification_submissions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.verification_id, VERIFICATION);
  assert.equal(row.selfie_image_url, "https://cdn.test/selfie.png");
  assert.equal(row.face_match_score, 91);
  assert.equal(row.provider_response, '{"a":2,"z":1}');
  assert.equal(row.status, "APPROVED");
  assert.equal(row.reviewed_by_admin_id, ADMIN);
  assertColumns(result);

  const absent = map("face_verification_submissions", { _id: REPORT, userId: USER, verificationId: VERIFICATION });
  assert.equal(table(absent.result, "face_verification_submissions")[0].provider_response, null);
});

test("voice verification submissions require the prompt text", () => {
  const { result } = map("voice_verification_submissions", {
    _id: REPORT, userId: USER, verificationId: VERIFICATION,
    audioUrl: "https://cdn.test/voice.ogg", transcriptText: "hello", promptText: "Say hello",
    voiceLivenessScore: 80, voiceMatchScore: 85, audioQualityScore: 90,
    provider: "test-provider", providerResponse: { score: 85 }, status: "NEEDS_RETRY"
  });
  const row = table(result, "voice_verification_submissions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.prompt_text, "Say hello");
  assert.equal(row.voice_match_score, 85);
  assert.equal(row.provider_response, '{"score":85}');
  assert.equal(row.status, "NEEDS_RETRY");
  assertColumns(result);

  const bad = map("voice_verification_submissions", { _id: REPORT, userId: USER, verificationId: VERIFICATION });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);
});

test("user safety statuses keep bounded trust score and all restriction flags", () => {
  const { result } = map("user_safety_statuses", {
    _id: REPORT, userId: USER, trustScore: 100, riskLevel: "CRITICAL",
    warningCount: 2, reportCount: 5, suspensionCount: 1,
    isShadowBanned: true, isChatRestricted: true, isRoomRestricted: false, isWalletFrozen: true,
    lastReviewedBy: ADMIN, lastReviewedAt: "2026-01-03T00:00:00Z"
  });
  const row = table(result, "user_safety_statuses")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.trust_score, 100);
  assert.equal(row.risk_level, "CRITICAL");
  assert.equal(row.report_count, 5);
  assert.equal(row.is_shadow_banned, 1);
  assert.equal(row.is_chat_restricted, 1);
  assert.equal(row.is_room_restricted, 0);
  assert.equal(row.is_wallet_frozen, 1);
  assert.equal(row.last_reviewed_by, ADMIN);
  assertColumns(result);

  const defaults = map("user_safety_statuses", { _id: REPORT, userId: USER });
  assert.equal(defaults.result.rejected, false);
  assert.equal(table(defaults.result, "user_safety_statuses")[0].trust_score, 100);
  assert.equal(table(defaults.result, "user_safety_statuses")[0].risk_level, "LOW");

  const bad = map("user_safety_statuses", { _id: REPORT, userId: USER, trustScore: 101 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("moderation mappings are reachable through the registry", () => {
  for (const collection of [
    "reports", "moderation_queues", "moderation_actions", "admin_audit_logs",
    "admin_moderation_actions", "support_tickets", "support_messages",
    "trust_verifications", "face_verification_submissions",
    "voice_verification_submissions", "user_safety_statuses"
  ]) {
    assert.equal(typeof getMapping(collection), "function", collection);
  }
});
