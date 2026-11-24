import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Admin(db, request, adminJwtSecret, regularToken) {
  const root = "/api/admin";
  const adminId = id();
  const limitedId = id();
  const sessionId = id();
  const time = new Date().toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();

  for (const [admin, role] of [[adminId, "ADMIN"], [limitedId, "SUPPORT_AGENT"]]) {
    await db.prepare(`INSERT INTO admin_users
      (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', 0, 0, ?, ?)`)
      .bind(admin, `${admin}@fixture.test`, `Fixture ${role}`, role, time, time).run();
  }
  await db.prepare(`INSERT INTO admin_sessions
    (source_id, admin_id, refresh_token_hash, expires_at, created_at, updated_at) VALUES (?, ?, 'fixture', ?, ?, ?)`)
    .bind(sessionId, adminId, future, time, time).run();

  const token = (sub, role) => jwt.sign(
    { sub, role, ...(sub === adminId ? { sessionId } : {}), type: "admin" },
    adminJwtSecret, { expiresIn: "15m" }
  );
  const adminToken = token(adminId, "ADMIN");
  const limitedToken = token(limitedId, "SUPPORT_AGENT");
  const as = (accessToken, path, status, options = {}) =>
    request(path, status, { accessToken, ...options });
  const get = (accessToken, path, status) => as(accessToken, path, status);
  const put = (accessToken, path, status, body) => as(accessToken, path, status, { method: "PUT", body });
  const del = (accessToken, path, status) => as(accessToken, path, status, { method: "DELETE" });

  // Admin errors use the admin envelope, not the user-facing { ok } envelope.
  const unauth = await request(`${root}/config`, 401);
  assert.equal(unauth.success, false);
  assert.equal(unauth.ok, undefined);
  await get(regularToken, `${root}/config`, 401);
  await get(limitedToken, `${root}/config`, 403);
  await get(adminToken, `${root}/audit-logs`, 200);
  await get(limitedToken, `${root}/audit-logs`, 403);

  // Authorization runs before validateBody on write routes.
  const invalidBody = { value: "x", description: "x".repeat(501) };
  await put(regularToken, `${root}/config/bad`, 401, invalidBody);
  await put(limitedToken, `${root}/config/bad`, 403, invalidBody);

  assert.deepEqual((await get(adminToken, `${root}/config`, 200)).data, []);
  assert.equal((await get(adminToken, `${root}/config/missing`, 200)).data, null);

  const created = await put(adminToken, `${root}/config/welcome.title`, 200,
    { value: "Hello", description: "Landing title" });
  assert.equal(created.success, true);
  assert.equal(created.data.config.key, "welcome.title");
  assert.equal(created.data.config.value, "Hello");
  assert.equal(created.data.config.description, "Landing title");
  const stored = await db.prepare("SELECT value, updated_by FROM app_config WHERE \"key\" = ?")
    .bind("welcome.title").first();
  assert.equal(stored.value, '"Hello"');
  assert.equal(stored.updated_by, adminId);
  assert.equal((await get(adminToken, `${root}/config/welcome.title`, 200)).data.value, "Hello");

  const updated = await put(adminToken, `${root}/config/welcome.title`, 200, { value: { enabled: true } });
  assert.deepEqual(updated.data.config.value, { enabled: true });
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM app_config WHERE \"key\" = ?")
    .bind("welcome.title").first("count"), 1);
  await put(adminToken, `${root}/config/bad`, 422, invalidBody);

  const logs = (await get(adminToken, `${root}/audit-logs?action=config.changed&entityType=app_config`, 200));
  assert.equal(logs.success, true);
  assert.equal(logs.meta.total, 2);
  assert.ok(logs.data.every(log => log.action === "config.changed" && log.entityType === "app_config"));
  assert.equal(logs.data[0].adminId._id, adminId);
  assert.equal(logs.data[0].adminId.email, `${adminId}@fixture.test`);
  assert.ok(logs.data[0].metadata.before);
  assert.ok(logs.data[0].metadata.after);
  assert.equal((await get(adminToken, `${root}/audit-logs?adminId=not-an-id`, 400)).success, false);

  assert.equal((await del(adminToken, `${root}/config/welcome.title`, 200)).data.deleted, true);
  assert.equal((await del(adminToken, `${root}/config/welcome.title`, 200)).data.deleted, false);
  assert.equal(await db.prepare("SELECT 1 FROM app_config WHERE \"key\" = ?").bind("welcome.title").first(), null);
  assert.equal((await get(adminToken, `${root}/audit-logs?action=config.deleted`, 200)).meta.total, 2);

  // An expired session is rejected even with a still-valid access token.
  await db.prepare("UPDATE admin_sessions SET expires_at = ? WHERE source_id = ?")
    .bind(new Date(Date.now() - 1000).toISOString(), sessionId).run();
  await get(adminToken, `${root}/config`, 401);
}
