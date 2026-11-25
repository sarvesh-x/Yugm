import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1AdminSupport(db, request, adminJwtSecret, owner, visitor) {
  const root = "/api/admin/support";
  const adminId = id();
  const limitedId = id();
  const userId = owner.user.id;
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

  const customer = "/api/support/tickets";
  const ownerToken = owner.accessToken;
  const visitorToken = visitor.accessToken;
  const ticketBody = { subject: "Charged twice", message: "Please help me with the charges", category: "Payment", priority: "URGENT" };
  await post(undefined, customer, 401, ticketBody);
  await post(ownerToken, customer, 422, { ...ticketBody, message: "short" });
  const created = (await post(ownerToken, customer, 201, ticketBody)).data.ticket;
  const ticketId = created._id;
  const ownPath = `${customer}/${ticketId}`;
  assert.equal(created.messages[0].senderId, userId);
  assert.equal((await get(ownerToken, `${customer}?status=OPEN&limit=1`, 200)).data.total, 1);
  assert.equal((await get(visitorToken, customer, 200)).data.total, 0);
  await get(visitorToken, ownPath, 404);
  await post(visitorToken, `${ownPath}/messages`, 404, { message: "Denied" });
  await post(visitorToken, `${ownPath}/close`, 404, {});

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

  const requesterView = (await get(ownerToken, ownPath, 200)).data.ticket;
  assert.equal(requesterView.messages[1].senderId, adminId);
  assert.equal(requesterView.status, "RESOLVED");
  const replies = await Promise.all(["First reply", "Second reply"].map(message => post(ownerToken, `${ownPath}/messages`, 200, { message })));
  assert.ok(replies.every(reply => reply.data.ticket.status === "OPEN"));
  assert.deepEqual((await db.prepare("SELECT position FROM support_ticket_messages WHERE support_tickets_id = ? ORDER BY position")
    .bind(ticketId).all()).results.map(row => row.position), [0, 1, 2, 3]);
  assert.equal((await post(ownerToken, `${ownPath}/close`, 200, {})).data.ticket.status, "CLOSED");
  await post(ownerToken, `${ownPath}/messages`, 400, { message: "Too late" });

  const publicPath = "/api/support/public-requests";
  const publicBody = { email: "public@fixture.test", subject: "Delete account", message: "Please delete my account.", requestType: "ACCOUNT_DELETION" };
  const publicTicket = (await post(undefined, publicPath, 201, publicBody)).data;
  assert.deepEqual(Object.keys(publicTicket).sort(), ["received", "requestId"]);
  const publicAdminView = (await get(adminToken, `${root}/tickets/${publicTicket.requestId}`, 200)).data.ticket;
  assert.equal(publicAdminView.priority, "HIGH");
  assert.equal(publicAdminView.requesterEmail, publicBody.email);
  await get(ownerToken, `${customer}/${publicTicket.requestId}`, 404);
  for (let i = 0; i < 9; i++) await post(undefined, publicPath, 422, {});
  await post(undefined, publicPath, 429, publicBody);
}
