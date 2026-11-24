import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1AdminSupport(db, request, adminJwtSecret, userId) {
  const root = "/api/admin/support";
  const adminId = id();
  const limitedId = id();
  const ticketId = id();
  const time = new Date().toISOString();

  for (const [admin, role] of [[adminId, "ADMIN"], [limitedId, "ROOM_MODERATOR"]]) {
    await db.prepare(`INSERT INTO admin_users
      (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', 0, 0, ?, ?)`)
      .bind(admin, `${admin}@fixture.test`, `Fixture ${role}`, role, time, time).run();
  }

  const token = (sub, role) => jwt.sign({ sub, role, type: "admin" }, adminJwtSecret, { expiresIn: "15m" });
  const adminToken = token(adminId, "ADMIN");
  const limitedToken = token(limitedId, "ROOM_MODERATOR");
  const as = (accessToken, path, status, options = {}) =>
    request(path, status, { accessToken, ...options });
  const get = (accessToken, path, status) => as(accessToken, path, status);
  const post = (accessToken, path, status, body) => as(accessToken, path, status, { method: "POST", body });
  const patch = (accessToken, path, status, body) => as(accessToken, path, status, { method: "PATCH", body });

  await db.prepare(`INSERT INTO support_tickets
    (source_id, user_id, requester_email, category, subject, message, status, priority, created_at, updated_at)
    VALUES (?, ?, 'user@fixture.test', 'Payment', 'Charged twice', 'Please help', 'OPEN', 'URGENT', ?, ?)`)
    .bind(ticketId, userId, time, time).run();
  await db.prepare(`INSERT INTO support_ticket_messages
    (source_id, sender_id, sender_admin_id, sender_role, message, created_at, support_tickets_id, position)
    VALUES (?, ?, NULL, 'USER', 'I need help', ?, ?, 0)`)
    .bind(id(), userId, time, ticketId).run();

  await request(`${root}/tickets`, 401);
  await get(limitedToken, `${root}/tickets`, 403);
  const listed = await get(adminToken, `${root}/tickets`, 200);
  assert.equal(listed.success, true);
  assert.equal(listed.meta.total, 1);
  assert.equal(listed.data.tickets.length, 1);
  assert.equal(listed.data.tickets[0]._id, ticketId);
  assert.equal(listed.data.tickets[0].userId._id, userId);
  assert.equal(listed.data.tickets[0].messages[0].senderId, userId);
  assert.equal((await get(adminToken, `${root}/tickets?status=OPEN`, 200)).meta.total, 1);
  assert.equal((await get(adminToken, `${root}/tickets?status=CLOSED`, 200)).meta.total, 0);
  assert.equal((await get(adminToken, `${root}/tickets?priority=HIGH`, 200)).meta.total, 0);
  assert.equal((await get(adminToken, `${root}/tickets?category=Payment`, 200)).meta.total, 1);
  assert.equal((await get(adminToken, `${root}/tickets?category=Account`, 200)).meta.total, 0);
  assert.equal((await get(adminToken, `${root}/tickets?q=HELP`, 200)).meta.total, 1);
  assert.equal((await get(adminToken, `${root}/tickets?status=BOGUS`, 200)).meta.total, 1);

  const detail = await get(adminToken, `${root}/tickets/${ticketId}`, 200);
  assert.equal(detail.data.ticket.messages[0].senderId._id, userId);
  assert.equal(detail.data.ticket.assignedTo, undefined);
  await get(adminToken, `${root}/tickets/not-an-object-id`, 400);
  await get(adminToken, `${root}/tickets/${id()}`, 404);

  await post(limitedToken, `${root}/tickets/${ticketId}/respond`, 403, { message: "Denied" });
  await post(adminToken, `${root}/tickets/${ticketId}/respond`, 422, { message: "" });
  const responded = await post(adminToken, `${root}/tickets/${ticketId}/respond`, 200, { message: "Checking now" });
  assert.equal(responded.data.ticket.status, "IN_PROGRESS");
  assert.equal(responded.data.ticket.messages.length, 2);
  assert.equal(responded.data.ticket.messages[1].senderRole, "ADMIN");
  assert.equal(responded.data.ticket.messages[1].senderId, adminId);
  const reply = await db.prepare("SELECT sender_id, sender_admin_id, sender_role FROM support_ticket_messages WHERE support_tickets_id = ? AND position = 1")
    .bind(ticketId).first();
  assert.equal(reply.sender_id, null);
  assert.equal(reply.sender_admin_id, adminId);
  assert.equal(reply.sender_role, "ADMIN");
  assert.equal((await get(adminToken, "/api/admin/audit-logs?action=SUPPORT_RESPOND", 200)).meta.total, 1);

  await patch(adminToken, `${root}/tickets/${ticketId}/status`, 422, { status: "BOGUS" });
  const resolved = await patch(adminToken, `${root}/tickets/${ticketId}/status`, 200,
    { status: "RESOLVED", note: "fixed" });
  assert.equal(resolved.data.ticket.status, "RESOLVED");
  assert.ok(resolved.data.ticket.resolvedAt);
  await patch(adminToken, `${root}/tickets/${id()}/status`, 404, { status: "OPEN" });
  assert.equal((await get(adminToken, "/api/admin/audit-logs?action=SUPPORT_STATUS_UPDATE", 200)).meta.total, 1);

  await patch(adminToken, `${root}/tickets/${ticketId}/assign`, 400, { adminUserId: "not-an-id" });
  await patch(adminToken, `${root}/tickets/${id()}/assign`, 404, { adminUserId: adminId });
  const assigned = await patch(adminToken, `${root}/tickets/${ticketId}/assign`, 200, { adminUserId: limitedId });
  assert.equal(assigned.data.ticket.assignedTo, limitedId);
  assert.equal(await db.prepare("SELECT assigned_to FROM support_tickets WHERE source_id = ?")
    .bind(ticketId).first("assigned_to"), limitedId);
  assert.equal((await get(adminToken, "/api/admin/audit-logs?action=SUPPORT_ASSIGN", 200)).meta.total, 1);

  const stats = await get(adminToken, `${root}/stats`, 200);
  assert.deepEqual(stats.data.stats, { open: 0, inProgress: 0, resolved: 1, closed: 0, urgent: 1, total: 1 });
}
