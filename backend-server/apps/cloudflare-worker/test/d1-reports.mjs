import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Reports(db, request, secret, host, second, third, target) {
  const room = id();
  const targetId = target.user.id;
  const hostId = host.user.id;
  const time = new Date().toISOString();
  const evidenceText = "Fixture room evidence";
  const [admin, limited] = [id(), id()];
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Report fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PRIVATE', 8, 1, 0, ?, 0, 0, 0)`)
      .bind(room, hostId, `report-${room}`),
    db.prepare(`INSERT INTO chat_messages (source_id, room_id, sender_id, message, type, created_at)
      VALUES (?, ?, ?, ?, 'TEXT', ?)`).bind(id(), room, targetId, evidenceText, time),
    ...[[admin, "ROOM_MODERATOR"], [limited, "ANALYST"]].map(([key, role]) => db.prepare(`INSERT INTO admin_users
      (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled)
      VALUES (?, ?, 'Report fixture', ?, 'ACTIVE', 0, 0)`).bind(key, `${key}@fixture.test`, role))
  ]);
  const initialReportCount = await db.prepare("SELECT COUNT(*) AS count FROM reports WHERE target_user_id = ?")
    .bind(targetId).first("count");
  const reportPath = `/api/rooms/${room}/report`;
  const as = (account, path, status, body) => request(path, status, { accessToken: account.accessToken, body });
  const payload = { targetUserId: targetId, reason: "Fixture abuse report" };
  await request(reportPath, 401, { body: {} });
  await as(second, reportPath, 403, payload);
  await as(host, reportPath, 400, { ...payload, targetUserId: hostId.toUpperCase() });
  await as(host, "/api/reports", 404, { ...payload, targetUserId: id() });

  const first = (await as(host, reportPath, 201, payload)).data.report;
  assert.equal(first.roomId, room);
  assert.equal(first.status, "PENDING");
  assert.equal(first.evidence, undefined);
  assert.equal((await as(host, reportPath, 201, payload)).data.report.status, "PENDING");
  assert.equal((await as(second, "/api/reports", 201, payload)).data.report.status, "PENDING");
  await db.prepare(`CREATE TRIGGER fixture_report_mute_failure BEFORE INSERT ON moderation_actions
    WHEN NEW.report_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fixture report rollback'); END`).run();
  try {
    await as(third, "/api/reports", 500, payload);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM reports WHERE target_user_id = ?")
      .bind(targetId).first("count"), initialReportCount + 3);
  } finally {
    await db.prepare("DROP TRIGGER fixture_report_mute_failure").run();
  }
  const threshold = await Promise.all([
    as(third, "/api/reports", 201, payload),
    as(third, "/api/reports", 201, payload)
  ]);
  assert.equal(threshold.filter(result => result.data.report.status === "ACTION_TAKEN").length, 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM moderation_actions WHERE target_user_id = ? AND report_id IS NOT NULL")
    .bind(targetId).first("count"), 1);
  assert.ok(Date.parse(await db.prepare("SELECT muted_until FROM users WHERE source_id = ?").bind(targetId).first("muted_until")) >
    Date.now() + 11 * 60 * 60_000);
  const targetNotices = (await as(target, "/api/notifications", 200)).data.notifications;
  assert.equal(targetNotices.filter(item => item.title === "Account muted").length, 1);

  const adminToken = sub => ({ accessToken: jwt.sign({ sub, type: "admin" }, secret, { expiresIn: "15m" }) });
  const listPath = "/api/admin/reports";
  await as(host, listPath, 401);
  await as(adminToken(limited), listPath, 403);
  const list = await as(adminToken(admin), `${listPath}?targetType=ROOM&reason=fixture&limit=1`, 200);
  assert.equal(list.meta.total, 2);
  assert.equal(list.data.length, 1);
  const detail = (await as(adminToken(admin), `${listPath}/${first._id}`, 200)).data;
  assert.equal(detail.report.reporterId._id, hostId);
  assert.equal(detail.report.reporterId.email, undefined);
  assert.equal(detail.report.evidence.roomMessages[0].message, evidenceText);
  assert.equal(detail.report.evidence.directMessages.length, 2);
  assert.equal(detail.report.evidence.recentUniqueReporterCount, 1);
  assert.equal(detail.queue.targetId, room);
  assert.equal(detail.queue.aiScore, 28);
  assert.equal(detail.related.length, 5);
  assert.equal((await as(adminToken(admin), `/api/admin/rooms/${room}/reports`, 200)).data.length, 2);
  assert.equal((await as(adminToken(admin), `/api/admin/users/${targetId}/reports`, 200)).data.length, 5);
  await as(host, reportPath, 201, payload);
  await as(host, "/api/reports", 429, payload);
}
