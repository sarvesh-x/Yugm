import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { generate } from "otplib";

const id = () => randomBytes(12).toString("hex");
export const fixturePayoutWithdrawalId = "104010401040104010401040";

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
  const post = (accessToken, path, status, body) => as(accessToken, path, status, { method: "POST", body });
  const patch = (accessToken, path, status, body) => as(accessToken, path, status, { method: "PATCH", body });
  const del = (accessToken, path, status) => as(accessToken, path, status, { method: "DELETE" });

  // Admin errors use the admin envelope, not the user-facing { ok } envelope.
  const unauth = await request(`${root}/config`, 401);
  assert.equal(unauth.success, false);
  assert.equal(unauth.ok, undefined);
  await get(regularToken, `${root}/config`, 401);
  await get(limitedToken, `${root}/config`, 403);
  await get(adminToken, `${root}/audit-logs`, 200);
  await get(limitedToken, `${root}/audit-logs`, 403);
  await get(regularToken, `${root}/dashboard/overview`, 401);
  await get(limitedToken, `${root}/dashboard/overview`, 403);
  const dashboard = (await get(adminToken, `${root}/dashboard/overview`, 200)).data;
  assert.equal(dashboard.users.total, await db.prepare("SELECT COUNT(*) AS total FROM users").first("total"));
  assert.equal(typeof dashboard.wallet.coinsSpentToday, "number");
  assert.equal((await get(adminToken, `${root}/dashboard/system-health`, 200)).data.storage, "d1");
  for (const path of ["dashboard/live-rooms", "dashboard/revenue", "dashboard/moderation", "dashboard/user-growth",
    "dashboard/top-hosts", "dashboard/top-gifts", "dashboard/experience", "progression/health",
    "fraud/suspicious-users", "fraud/suspicious-wallets", "fraud/suspicious-rooms", "referrals", "referrals/stats"]) {
    await get(adminToken, `${root}/${path}`, 200);
  }
  for (const metric of ["users", "rooms", "messages", "reports", "matches", "retention", "wallet", "gifts", "revenue"]) {
    const base = `${root}/analytics/${metric}`;
    const { data } = await get(adminToken, `${base}?from=2000-01-01&to=2000-02-01`, 200);
    assert.equal(data.metric, metric);
    assert.deepEqual(data.data, ["wallet", "gifts", "revenue", "retention"].includes(metric) ? [] : 0);
  }

  const userId = await db.prepare("SELECT source_id FROM users ORDER BY source_id LIMIT 1").first("source_id");
  assert.ok(userId);
  const fraud = await post(adminToken, `${root}/fraud/users/${userId}/review`, 200, { notes: "Fixture review" });
  assert.ok(fraud.data.safety);
  await get(limitedToken, `${root}/payments/recharges`, 403);
  await get(limitedToken, `${root}/payout-reviews`, 403);
  const financePaths = ["wallet/transactions", "wallet/suspicious", `wallet/users/${userId}`, `wallet/users/${userId}/transactions`,
    "payments/revenue-summary", "payments/failed", "payments/refunds", "earnings", `earnings/users/${userId}`, "withdrawals", "payout-reviews"];
  for (const path of financePaths) await get(adminToken, `${root}/${path}`, 200);
  await get(adminToken, `${root}/wallet/transactions?userId=bad`, 400);
  const purchaseId = id();
  await db.prepare(`INSERT INTO purchases
    (source_id, user_id, provider, status, pack_id, asset_currency, coin_amount, diamond_amount, amount_inr, currency,
     google_order_id, purchase_token, provider_signature, metadata, created_at, updated_at)
    VALUES (?, ?, 'GOOGLE_PLAY', 'CREDITED', 'fixture', 'COINS', 100, 0, 49, 'INR', ?, 'token', 'signature', '{}', ?, ?)`)
    .bind(purchaseId, userId, `GPA.${purchaseId}`, time, time).run();
  const purchase = (await get(adminToken, `${root}/payments/recharges/GPA.${purchaseId}`, 200)).data;
  assert.equal(purchase._id, purchaseId);
  assert.equal(purchase.userId._id, userId);
  assert.equal(purchase.purchaseToken, undefined);
  assert.equal(purchase.providerSignature, undefined);
  const purchases = await get(adminToken, `${root}/payments/recharges?userId=${userId}&platform=GOOGLE_PLAY&status=CREDITED`, 200);
  assert.ok(purchases.data.some(item => item._id === purchaseId));
  const withdrawalId = id();
  const reviewId = id();
  await db.prepare(`INSERT INTO withdrawal_requests
    (source_id, user_id, amount_coins, amount_inr, status, active_lock, metadata, created_at, updated_at)
    VALUES (?, ?, 100, 10, 'PENDING_REVIEW', 1, '{}', ?, ?)`).bind(withdrawalId, userId, time, time).run();
  await db.prepare(`INSERT INTO payout_reviews (source_id, user_id, withdrawal_request_id, status,
    trust_verified, kyc_verified, wallet_safe, reports_safe, fraud_safe, risk_flags, created_at, updated_at)
    VALUES (?, ?, ?, 'PENDING', 1, 0, 1, 1, 1, '[]', ?, ?)`).bind(reviewId, userId, withdrawalId, time, time).run();
  const withdrawal = (await get(adminToken, `${root}/withdrawals/${withdrawalId}`, 200)).data;
  assert.equal(withdrawal.withdrawal.amountCoins, 100);
  assert.equal(withdrawal.payoutReview._id, reviewId);
  assert.equal((await get(adminToken, `${root}/payout-reviews/${reviewId}`, 200)).data.raw.withdrawalRequestId._id, withdrawalId);
  const reviews = (await get(adminToken, `${root}/payout-reviews?status=PENDING`, 200)).data.payoutReviews;
  assert.ok(reviews.some(review => review.id === reviewId && review.user._id === userId && review.withdrawal._id === withdrawalId));

  const giftBody = { name: `Admin gift ${id()}`, icon: "fixture", coinPrice: 25 };
  await post(limitedToken, `${root}/gifts`, 403, {});
  const gift = (await post(adminToken, `${root}/gifts`, 201, giftBody)).data.gift;
  const giftPath = `${root}/gifts/${gift._id}`;
  await post(adminToken, `${root}/gifts`, 409, giftBody);
  assert.equal((await get(adminToken, giftPath, 200)).data.isActive, true);
  assert.ok((await get(adminToken, `${root}/gifts`, 200)).data.some(item => item._id === gift._id));
  assert.equal((await patch(adminToken, giftPath, 200, { coinPrice: 50 })).data.gift.coinPrice, 50);
  assert.equal((await post(adminToken, `${giftPath}/deactivate`, 200)).data.gift.isActive, false);
  assert.equal((await post(adminToken, `${giftPath}/activate`, 200)).data.gift.isActive, true);
  assert.equal((await del(adminToken, giftPath, 200)).data.softDeleted, false);
  assert.equal((await get(adminToken, giftPath, 200)).data, null);
  assert.equal((await get(adminToken, `${root}/audit-logs?action=gift.created&entityType=gift`, 200)).meta.total, 1);

  const usedGift = (await post(adminToken, `${root}/gifts`, 201, giftBody)).data.gift;
  await db.prepare(`INSERT INTO gift_transactions (source_id, sender_id, receiver_id, gift_id, coin_amount,
    diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, 25, 0, 'COINS', 'send', 1, 25, '', '{}', ?, ?)`).bind(id(), userId, userId, usedGift._id, time, time).run();
  assert.equal((await del(adminToken, `${root}/gifts/${usedGift._id}`, 200)).data.softDeleted, true);
  assert.equal((await get(adminToken, `${root}/gifts/${usedGift._id}`, 200)).data.isActive, false);
  const earnings = (await get(adminToken, `${root}/earnings/users/${userId}`, 200)).data;
  assert.ok(earnings.some(item => item.giftId?._id === usedGift._id && item.senderId?._id === userId));

  const cosmeticBody = { id: `fixture-${id()}`, name: "Fixture Wave", type: "SPEAKING_WAVE", coinPrice: 42 };
  const cosmeticPath = `${root}/cosmetics/${cosmeticBody.id}`;
  await post(limitedToken, `${root}/cosmetics`, 403, {});
  const cosmetic = (await post(adminToken, `${root}/cosmetics`, 201, cosmeticBody)).data.data;
  assert.equal(cosmetic._id, cosmeticBody.id);
  assert.equal(cosmetic.isActive, true);
  await post(adminToken, `${root}/cosmetics`, 409, cosmeticBody);
  await put(adminToken, cosmeticPath, 404, { assetRef: id() });
  const foreignAsset = id();
  await db.prepare(`INSERT INTO assets (source_id, owner_type, owner_id, kind, status, version, original_name,
    mime_type, bytes, width, height, sha256, staging_key, staging_url, public_url, created_by)
    VALUES (?, 'cosmetic', 'different-cosmetic', 'IMAGE', 'published', 1, 'fixture.png', 'image/png',
    1, 1, 1, 'fixture', ?, 'fixture', 'https://fixture.test/file.png', ?)`).bind(foreignAsset, foreignAsset, adminId).run();
  await put(adminToken, cosmeticPath, 400, { assetRef: foreignAsset });
  await db.prepare("UPDATE assets SET owner_id = ? WHERE source_id = ?").bind(cosmeticBody.id, foreignAsset).run();
  const changedCosmetic = (await put(adminToken, cosmeticPath, 200, { coinPrice: 55, assetRef: foreignAsset })).data.data;
  assert.equal(changedCosmetic.assetRef, foreignAsset);
  assert.equal(changedCosmetic.coinPrice, 55);
  assert.equal((await get(adminToken, cosmeticPath, 200)).data.data.coinPrice, 55);
  const cosmetics = (await get(adminToken, `${root}/cosmetics?type=SPEAKING_WAVE&rarity=COMMON&q=fixture%20wave`, 200)).data;
  assert.ok(cosmetics.data.some(item => item._id === cosmeticBody.id));
  assert.equal((await del(adminToken, cosmeticPath, 200)).data.data.deleted, true);
  await get(adminToken, cosmeticPath, 404);
  await post(adminToken, `${root}/cosmetics/seed`, 200);
  assert.equal((await post(adminToken, `${root}/cosmetics/seed`, 200)).data.data.seeded, 0);

  const message = { title: `Notification fixture ${id()}`, body: "Admin test message" };
  const notices = `${root}/notifications`;
  await post(regularToken, `${notices}/send-user`, 401, {});
  await post(adminToken, `${notices}/send-user`, 404, { ...message, userId: id() });
  const sent = (await post(adminToken, `${notices}/send-user`, 200, { ...message, userId })).data.notification;
  assert.equal(sent.userId, userId);
  assert.equal(sent.read, false);
  await post(adminToken, `${notices}/send-segment`, 422, { ...message, segment: "city" });
  const city = `Fixture ${id()}`;
  const storedCity = await db.prepare("SELECT city FROM users WHERE source_id = ?").bind(userId).first("city");
  await db.prepare("UPDATE users SET city = ? WHERE source_id = ?").bind(city, userId).run();
  try {
    assert.equal((await post(adminToken, `${notices}/send-segment`, 200, { ...message, segment: "city", city })).data.sent, 1);
    const allTargets = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_blocked = 0").first("count");
    assert.equal((await post(adminToken, `${notices}/send-all`, 200, message)).data.sent, allTargets);
    await post(adminToken, `${notices}/campaigns`, 422, { ...message, segment: "custom" });
    const campaign = (await post(adminToken, `${notices}/campaigns`, 201,
      { ...message, segment: "custom", filters: { city } })).data.campaign;
    const campaignPath = `${notices}/campaigns/${campaign._id}`;
    assert.equal((await get(adminToken, campaignPath, 200)).data.campaign.createdBy._id, adminId);
    assert.ok((await get(adminToken, `${notices}/campaigns`, 200)).data.campaigns.some(item => item._id === campaign._id));
    assert.deepEqual((await post(adminToken, `${campaignPath}/send`, 200)).data, { sent: 1, delivered: 1 });
    const delivered = (await get(adminToken, campaignPath, 200)).data.campaign;
    assert.equal(delivered.status, "SENT");
    assert.equal(delivered.sentCount, 1);
    assert.equal(delivered.deliveredCount, 1);
    await post(adminToken, `${campaignPath}/send`, 400);
    await post(adminToken, `${campaignPath}/cancel`, 400);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE json_extract(data, '$.campaignId') = ?")
      .bind(campaign._id).first("count"), 1);
    const draft = (await post(adminToken, `${notices}/campaigns`, 201, { ...message, segment: "all" })).data.campaign;
    assert.equal((await post(adminToken, `${notices}/campaigns/${draft._id}/cancel`, 200)).data.campaign.status, "CANCELLED");
    await post(adminToken, `${notices}/campaigns/${draft._id}/send`, 400);
  } finally {
    await db.prepare("UPDATE users SET city = ? WHERE source_id = ?").bind(storedCity, userId).run();
    await db.prepare("DELETE FROM notifications WHERE title = ?").bind(message.title).run();
  }

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

export async function verifyD1AdminSessions(db, request) {
  const root = "/api/admin";
  const adminId = id();
  const email = `${adminId}@fixture.test`;
  const password = "local-fixture-password";
  await db.prepare(`INSERT INTO admin_users (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled, password_hash)
    VALUES (?, ?, 'Session fixture', 'SUPER_ADMIN', 'ACTIVE', 1, 0, ?)`)
    .bind(adminId, email, await bcrypt.hash(password, 4)).run();
  let requestIndex = 30;
  const as = (path, status, body, accessToken, method = "POST", headers) =>
    request(root + path, status, { body, accessToken, ip: `198.51.100.${requestIndex++}`, method, headers });

  await as("/auth/login", 401, { email, password: "wrong password" });
  const login = (await as("/auth/login", 200, { email: email.toUpperCase(), password })).data;
  assert.equal(login.admin.id, adminId);
  assert.equal(login.admin.passwordHash, undefined);
  assert.equal((await as("/auth/me", 200, undefined, login.accessToken, "GET")).data.admin.id, adminId);
  const refreshed = (await as("/auth/refresh", 200, { refreshToken: login.refreshToken })).data;
  await as("/auth/me", 200, undefined, refreshed.accessToken, "GET");
  const setup = (await as("/auth/2fa/setup", 200, {}, login.accessToken)).data;
  assert.match(setup.qrCode, /^data:image\/svg\+xml;base64,/);
  assert.match(setup.uri, /^otpauth:\/\/totp\//);
  let code = await generate({ secret: setup.secret });
  const wrong = code === "000000" ? "000001" : "000000";
  await as("/auth/2fa/verify", 400, { token: wrong }, login.accessToken);
  await as("/auth/2fa/verify", 200, { token: code }, login.accessToken);
  assert.equal((await as("/auth/2fa/status", 200, {}, login.accessToken)).data.enabled, true);
  await as("/auth/2fa/setup", 409, {}, login.accessToken);

  const challenge = (await as("/auth/login", 200, { email, password })).data;
  assert.equal(challenge.twoFactorRequired, true);
  assert.equal(challenge.accessToken, undefined);
  await as("/auth/refresh", 401, { refreshToken: challenge.twoFactorToken });
  const challengeBody = { adminId, twoFactorToken: challenge.twoFactorToken };
  await as("/auth/2fa/login", 401, { ...challengeBody, token: wrong });
  code = await generate({ secret: setup.secret });
  const session = (await as("/auth/2fa/login", 200, { ...challengeBody, token: code })).data;
  await as("/auth/2fa/login", 401, { ...challengeBody, token: code });

  const account = await db.prepare(`SELECT u.source_id, u.wallet_balance FROM users u WHERE u.is_blocked = 0
    AND NOT EXISTS (SELECT 1 FROM user_safety_statuses s WHERE s.user_id = u.source_id AND s.is_wallet_frozen = 1)
    ORDER BY u.source_id LIMIT 1`).first();
  const walletPath = `/wallet/users/${account.source_id}`;
  const adjustment = { type: "CREDIT", amount: 25, reason: "Fixture credit" };
  const once = { "Idempotency-Key": id() };
  const first = await as(walletPath + "/adjust", 201, adjustment, session.accessToken, "POST", once);
  const replay = await as(walletPath + "/adjust", 200, adjustment, session.accessToken, "POST", once);
  assert.equal(replay.data.transaction._id, first.data.transaction._id);
  assert.equal(first.data.transaction.balanceAfter, account.wallet_balance + 25);
  await as(walletPath + "/adjust", 409, { ...adjustment, amount: 26 }, session.accessToken, "POST", once);
  await as(walletPath + "/adjust", 400, { ...adjustment, amount: 10000 }, session.accessToken);
  await as(walletPath + "/adjust", 403, { ...adjustment, amount: 10000 }, session.accessToken, "POST",
    { "X-Approval-Admin-Token": session.accessToken });
  await as(walletPath + "/freeze", 200, { reason: "Fixture freeze" }, session.accessToken);
  await as(walletPath + "/adjust", 403, adjustment, session.accessToken);
  await as(walletPath + "/unfreeze", 200, {}, session.accessToken);
  await as(walletPath + "/adjust", 201, { ...adjustment, type: "DEBIT" }, session.accessToken);
  const compatible = await as("/wallet/adjust", 201, { userId: account.source_id, amount: 25,
    direction: "CREDIT", reason: "Fixture credit" }, session.accessToken);
  assert.equal(compatible.ok, true);
  await as("/wallet/adjust", 201, { userId: account.source_id, amount: 25, direction: "DEBIT",
    reason: "Fixture debit" }, session.accessToken);
  assert.equal(await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(account.source_id).first("wallet_balance"),
    account.wallet_balance);

  const inviteEmail = `${id()}@fixture.test`;
  const invited = (await as("/auth/invite", 201, { email: inviteEmail, displayName: "Invite fixture", role: "SUPPORT_AGENT" }, session.accessToken)).data;
  assert.equal(invited.admin.status, "INVITED");
  await as("/auth/accept-invite", 200, { invitationToken: invited.invitationToken, password });
  await as("/auth/accept-invite", 404, { invitationToken: invited.invitationToken, password });
  const accepted = (await as("/auth/login", 200, { email: inviteEmail, password })).data;
  await as("/admin-users", 403, undefined, accepted.accessToken, "GET");
  const assigned = (await as(`/admin-users/${invited.admin.id}`, 200,
    { role: "ANALYST", permissions: ["reports.read"] }, session.accessToken, "PATCH")).data.admin;
  assert.equal(assigned.role, "ANALYST");
  assert.ok(assigned.permissions.includes("reports.read"));
  const rows = (await as("/admin-users", 200, undefined, session.accessToken, "GET")).data;
  assert.ok(rows.some(row => row.id === invited.admin.id));
  const created = (await as("/admin-users", 201,
    { email: `${id()}@fixture.test`, displayName: "Created fixture", role: "SUPPORT_AGENT", firebaseUid: id() },
    session.accessToken)).data.admin;
  assert.equal(created.status, "ACTIVE");
  await as(`/admin-users/${invited.admin.id}`, 200, { status: "SUSPENDED" }, session.accessToken, "PATCH");
  await as("/auth/me", 401, undefined, accepted.accessToken, "GET");

  code = await generate({ secret: setup.secret });
  await as("/auth/2fa/disable", 200, { token: code }, session.accessToken);
  await as("/auth/change-password", 200, { currentPassword: password, newPassword: password + "-changed" }, session.accessToken);
  await as("/auth/refresh", 401, { refreshToken: session.refreshToken });
  await as("/auth/login", 401, { email, password });
  const changed = (await as("/auth/login", 200, { email, password: password + "-changed" })).data;
  await as("/auth/logout", 200, {}, changed.accessToken);
  await as("/auth/refresh", 401, { refreshToken: changed.refreshToken });
  await as("/auth/me", 401, undefined, changed.accessToken, "GET");
}

export async function verifyD1AdminAssets(db, worker, secret, png, razorpayWebhookSecret) {
  const root = "http://127.0.0.1/api/admin";
  const adminId = id();
  const sessionId = id();
  await db.batch([
    db.prepare(`INSERT INTO admin_users (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled)
      VALUES (?, ?, 'Asset fixture', 'ADMIN', 'ACTIVE', 0, 0)`).bind(adminId, `${adminId}@fixture.test`),
    db.prepare(`INSERT INTO admin_sessions (source_id, admin_id, refresh_token_hash, expires_at)
      VALUES (?, ?, 'fixture', ?)`).bind(sessionId, adminId, new Date(Date.now() + 900_000).toISOString())
  ]);
  const token = jwt.sign({ sub: adminId, sessionId, type: "admin" }, secret, { expiresIn: "15m" });
  const fetch = async (path, method = "GET", body) => {
    const headers = { Authorization: `Bearer ${token}` };
    if (typeof body === "string") headers["content-type"] = "application/json";
    const input = new Request(root + path, { method, body, headers });
    return worker.dispatchFetch(root + path, { method, headers: [...input.headers],
      ...(body ? { body: new Uint8Array(await input.arrayBuffer()) } : {}) });
  };
  const json = async (path, status, method, body) => {
    const response = await fetch(path, method, body);
    const received = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(received)}`);
    return received.data;
  };
  const owner = `asset-fixture-${id()}`;
  const upload = () => {
    const form = new FormData();
    form.set("ownerType", "badge");
    form.set("ownerId", owner);
    form.set("originalName", "fixture.png");
    form.set("asset", new Blob([png], { type: "image/png" }), "fixture.png");
    return form;
  };
  const staged = (await json("/assets", 201, "POST", upload())).asset;
  assert.equal(staged.status, "staging");
  assert.equal(staged.publicUrl, undefined);
  assert.equal((await json("/assets", 201, "POST", upload())).asset.id, staged.id);
  assert.equal((await json(`/assets?ownerType=badge&ownerId=${owner}`, 200)).assets.length, 1);
  const stagingPath = `/assets/staging/${staged.id}.png`;
  assert.equal((await worker.dispatchFetch(root + stagingPath)).status, 401);
  const original = await fetch(stagingPath);
  assert.equal(original.status, 200);
  assert.equal(original.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await original.arrayBuffer()), Buffer.from(png));
  const published = (await json(`/assets/${staged.id}/publish`, 200, "POST")).asset;
  assert.equal(published.status, "published");
  assert.deepEqual(published.variants.map(item => item.name), ["full", "preview"]);
  const image = await worker.dispatchFetch(published.publicUrl);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.ok((await image.arrayBuffer()).byteLength);
  assert.equal((await json(`/assets/${staged.id}`, 200)).asset.publicUrl, published.publicUrl);
  assert.equal((await json(`/assets/${staged.id}/publish`, 200, "POST")).asset.publicKey, published.publicKey);
  await json(`/assets/${staged.id}`, 200, "DELETE");
  assert.equal((await fetch(stagingPath)).status, 404);
  assert.equal((await worker.dispatchFetch(published.publicUrl)).status, 404);
  await json(`/assets/${staged.id}`, 200, "DELETE");
  const stored = await worker.getR2Bucket("ASSETS");
  assert.equal(await stored.get(published.publicKey), null);
  assert.ok(Array.isArray((await json("/media?category=AVATAR", 200)).media));
  const sessions = (await json("/media/sessions", 200)).sessions;
  assert.ok(sessions.every(item => typeof item.quotaReserved === "boolean" && item.uploadTokenHash === undefined));
  assert.ok(Array.isArray((await json("/media/quotas", 200)).quotas));
  assert.match((await json("/media/quota-reconciliation", 200)).reconciliation.digest, /^[a-f0-9]{64}$/);

  const badge = { id: owner, title: "Fixture Badge", description: "Fixture description", kind: "ACHIEVEMENT",
    metric: "profile_complete", icon: "trophy", order: 123, tiers: [{ tier: "BRONZE", target: 1, rewardCoins: 25 }] };
  const badgeForm = new FormData();
  badgeForm.set("definition", JSON.stringify(badge));
  badgeForm.set("image", new Blob([png], { type: "image/png" }), "fixture.png");
  await json("/badges", 201, "POST", badgeForm);
  await json("/badges", 409, "POST", JSON.stringify(badge));
  const savedBadge = (await json("/badges", 200)).badges.find(item => item.id === badge.id);
  assert.equal(savedBadge.tiers[0].rewardCoins, 25);
  const badgeUrl = "http://127.0.0.1" + savedBadge.imageUrl;
  const badgeImage = await worker.dispatchFetch(badgeUrl);
  assert.equal(badgeImage.status, 200);
  assert.deepEqual(Buffer.from(await badgeImage.arrayBuffer()), Buffer.from(png));
  await json(`/badges/${badge.id}`, 200, "PUT", JSON.stringify({
    ...badge, tiers: [{ tier: "BRONZE", target: 2, rewardCoins: 50 }]
  }));
  const updatedBadge = (await json("/badges", 200)).badges.find(item => item.id === badge.id);
  assert.equal(updatedBadge.tiers[0].rewardCoins, 50);
  await json(`/badges/${badge.id}`, 200, "DELETE");
  assert.equal((await worker.dispatchFetch(badgeUrl)).status, 404);

  const reactionForm = new FormData();
  reactionForm.set("id", owner);
  reactionForm.set("label", "Fixture Reaction");
  reactionForm.set("asset", new Blob([png], { type: "image/png" }), "fixture.png");
  const createdReaction = (await json("/reactions", 201, "POST", reactionForm)).reaction;
  assert.equal(createdReaction.isActive, true);
  assert.equal((await worker.dispatchFetch(createdReaction.assetUrl)).status, 200);
  const updatedReaction = (await json(`/reactions/${owner}`, 200, "PATCH", JSON.stringify({ isActive: false }))).reaction;
  assert.equal(updatedReaction.isActive, false);
  assert.equal((await worker.dispatchFetch(createdReaction.assetUrl)).status, 404);
  const matching = (await json("/reactions?q=Fixture%20Reaction&active=false", 200)).reactions;
  assert.ok(matching.some(item => item.id === owner));
  await json(`/reactions/${owner}`, 200, "DELETE");
  assert.equal(await stored.get(createdReaction.assetStorageKey), null);

  // Earlier fixtures may already have created a KYC row for the lexicographically
  // first user. Pick a user without one so the detail assertion is deterministic.
  const user = await db.prepare(`SELECT u.source_id, u.is_verified FROM users AS u
    WHERE NOT EXISTS (SELECT 1 FROM creator_payout_kycs AS k WHERE k.user_id = u.source_id)
      AND NOT EXISTS (SELECT 1 FROM withdrawal_requests AS w WHERE w.user_id = u.source_id AND w.active_lock = 1)
    ORDER BY u.source_id LIMIT 1`).first();
  assert.ok(user);
  const verificationId = id();
  const creatorKycId = id();
  const time = new Date().toISOString();
  const mediaFile = `${user.source_id}_${Date.now()}_${id().slice(0, 6)}.png`;
  const label = `/api/trust-verification/media/${mediaFile}`;
  await db.batch([
    db.prepare(`INSERT INTO trust_verifications (source_id, user_id, status, level, face_status, voice_status, liveness_status,
      verified_badge_enabled, creator_trust_enabled, submitted_at) VALUES (?, ?, 'PENDING_REVIEW', 'BASIC',
      'SUBMITTED', 'SUBMITTED', 'NOT_SUBMITTED', 0, 0, ?)`).bind(verificationId, user.source_id, time),
    db.prepare(`INSERT INTO face_verification_submissions (source_id, user_id, verification_id, selfie_image_url,
      provider_response, status) VALUES (?, ?, ?, ?, '{"internal":"private"}', 'SUBMITTED')`).bind(id(), user.source_id, verificationId, label),
    db.prepare(`INSERT INTO creator_payout_kycs (source_id, user_id, pan_number_encrypted, pan_last4,
      pan_verified, kyc_status, payout_status, metadata, submitted_at)
      VALUES (?, ?, 'fixture-ciphertext', '4321', 0, 'PENDING', 'DISABLED', '{}', ?)`).bind(creatorKycId, user.source_id, time)
  ]);
  const privateMedia = await worker.getR2Bucket("PRIVATE_MEDIA");
  await privateMedia.put(`trust-verification/${mediaFile}`, new Uint8Array(png));
  const trustRoot = `/trust-verifications/${verificationId}`;
  assert.ok((await json("/trust-verifications?status=PENDING_REVIEW", 200)).trustVerifications
    .some(item => item.id === verificationId));
  const verification = await json(trustRoot, 200);
  assert.deepEqual(verification.submissionCounts, { face: 1, voice: 0 });
  assert.equal(verification.faceSubmissions[0].providerResponse, undefined);
  const privatePath = `/trust-verifications/media/${mediaFile}`;
  assert.equal((await worker.dispatchFetch(root + privatePath)).status, 401);
  const privateRead = await fetch(privatePath);
  assert.equal(privateRead.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await privateRead.arrayBuffer()), Buffer.from(png));
  const pendingReview = await json(trustRoot + "/request-retry", 200, "POST", "{}");
  assert.equal(pendingReview.trustVerification.status, "NEEDS_RETRY");
  await json(trustRoot + "/approve", 200, "POST", "{}");
  assert.equal(await db.prepare("SELECT is_verified FROM users WHERE source_id = ?").bind(user.source_id).first("is_verified"), 1);
  await json(trustRoot + "/suspend", 200, "POST", "{}");
  await json(trustRoot + "/reject", 200, "POST", JSON.stringify({ rejectionReason: "Fixture review" }));
  await db.prepare("UPDATE users SET is_verified = ? WHERE source_id = ?").bind(user.is_verified, user.source_id).run();

  const kycPath = `/creator-kyc/${user.source_id}`;
  assert.ok((await json("/creator-kyc?status=PENDING", 200)).creatorKyc.some(item => item.userId === user.source_id));
  const review = (await json(kycPath, 200)).creatorKyc;
  assert.equal(review.panLast4, "4321");
  assert.equal(review.panNumberEncrypted, undefined);
  await json(kycPath + "/enable-payout", 409, "POST", "{}");
  await json(kycPath + "/approve", 200, "POST", "{}");
  assert.equal((await json(kycPath + "/freeze-payout", 200, "POST", "{}")).creatorKyc.payoutStatus, "FROZEN");
  assert.equal((await json(kycPath + "/enable-payout", 200, "POST", "{}")).creatorKyc.payoutStatus, "ENABLED");
  await json(kycPath + "/request-retry", 200, "POST", "{}");
  await json(kycPath + "/reject", 200, "POST", JSON.stringify({ rejectionReason: "Fixture review" }));
  const newWithdrawal = async (withdrawalId = id()) => {
    const payoutId = id();
    await db.batch([
      db.prepare(`INSERT INTO withdrawal_requests (source_id, user_id, amount_coins, amount_inr, status, active_lock, metadata)
        VALUES (?, ?, 50, 5, 'PENDING_REVIEW', 1, '{}')`).bind(withdrawalId, user.source_id),
      db.prepare(`INSERT INTO payout_reviews (source_id, user_id, withdrawal_request_id, trust_verification_id, creator_payout_kyc_id,
        status, trust_verified, kyc_verified, wallet_safe, reports_safe, fraud_safe, risk_flags)
        VALUES (?, ?, ?, ?, ?, 'PENDING', 1, 1, 1, 1, 1, '[]')`)
        .bind(payoutId, user.source_id, withdrawalId, verificationId, creatorKycId)
    ]);
    return { withdrawalPath: `/withdrawals/${withdrawalId}`, payoutPath: `/payout-reviews/${payoutId}` };
  };
  const { withdrawalPath, payoutPath } = await newWithdrawal(fixturePayoutWithdrawalId);
  await json(payoutPath + "/approve", 409, "POST", "{}");
  await json(withdrawalPath + "/request-info", 200, "POST", JSON.stringify({ reason: "Fixture request" }));
  const manual = (await json(payoutPath + "/manual-review", 200, "POST", "{}")).payoutReview;
  assert.equal(manual.status, "NEEDS_MANUAL_REVIEW");
  await json(payoutPath + "/manual-review", 200, "POST", "{}");
  await json(trustRoot + "/approve", 200, "POST", "{}");
  await json(kycPath + "/approve", 200, "POST", "{}");
  assert.equal((await json(withdrawalPath + "/approve", 200, "POST", "{}")).withdrawal.status, "APPROVED");
  assert.equal((await json(payoutPath + "/approve", 200, "POST", "{}")).payoutReview.status, "APPROVED");
  await json(payoutPath + "/reject", 409, "POST", JSON.stringify({ rejectionReason: "Fixture reason" }));
  await json(payoutPath + "/mark-paid", 409, "POST", JSON.stringify({ payoutReference: "pout_fixturequeued" }));
  const paid = await json(payoutPath + "/mark-paid", 200, "POST", JSON.stringify({ payoutReference: "pout_fixturepaid" }));
  assert.equal(paid.withdrawal.status, "PAID");
  assert.equal(paid.withdrawal.activeLock, false);
  assert.equal(paid.payoutReview.payout.providerStatus, "PROCESSED");
  await json(withdrawalPath + "/mark-paid", 200, "POST", JSON.stringify({ payoutReference: "pout_fixturepaid" }));
  const second = await newWithdrawal();
  const rejected = await json(second.withdrawalPath + "/reject", 200, "POST", JSON.stringify({ reason: "Fixture rejection" }));
  assert.equal(rejected.withdrawal.status, "REJECTED");
  assert.equal(rejected.withdrawal.activeLock, false);
  await json(second.payoutPath + "/reject", 200, "POST", JSON.stringify({ rejectionReason: "Fixture rejection" }));
  await db.prepare("UPDATE users SET is_verified = ? WHERE source_id = ?").bind(user.is_verified, user.source_id).run();

  // Razorpay payout webhook: signature, idempotency, and terminal transitions.
  assert.ok(razorpayWebhookSecret);
  const webhookPayoutId = "pout_webhook_fixture";
  const webhookWithdrawalId = id();
  const webhookReviewId = id();
  await db.batch([
    db.prepare(`INSERT INTO withdrawal_requests
      (source_id, user_id, amount_coins, amount_inr, status, active_lock, metadata, created_at, updated_at)
      VALUES (?, ?, 50, 5, 'PENDING_REVIEW', 1, '{}', ?, ?)`)
      .bind(webhookWithdrawalId, user.source_id, time, time),
    db.prepare(`INSERT INTO payout_reviews (source_id, user_id, withdrawal_request_id, status,
      trust_verified, kyc_verified, wallet_safe, reports_safe, fraud_safe, risk_flags,
      provider_payout_id, provider_status, created_at, updated_at)
      VALUES (?, ?, ?, 'PENDING', 1, 1, 1, 1, 1, '[]', ?, 'PROCESSING', ?, ?)`)
      .bind(webhookReviewId, user.source_id, webhookWithdrawalId, webhookPayoutId, time, time)
  ]);
  const webhook = (body, status, signature) => {
    const raw = JSON.stringify(body);
    const headers = { "content-type": "application/json" };
    if (signature !== null) {
      headers["X-Razorpay-Signature"] = signature ?? createHmac("sha256", razorpayWebhookSecret)
        .update(raw).digest("hex");
    }
    const response = worker.dispatchFetch("http://127.0.0.1/api/payments/webhook/payout", {
      method: "POST", headers, body: raw
    });
    return response.then(async received => {
      const payload = await received.json();
      assert.equal(received.status, status, `/api/payments/webhook/payout: ${JSON.stringify(payload)}`);
      return payload;
    });
  };
  const processedAt = 1_700_000_100;
  const processedBody = { event: "payout.processed", payload: { payout: {
    id: webhookPayoutId, status: "processed", amount: 500, currency: "INR",
    created_at: 1_700_000_000, processed_at: processedAt
  } } };
  await webhook(processedBody, 401, "00");
  const processedWebhook = await webhook(processedBody, 200);
  assert.equal(processedWebhook.received, "payout.processed");
  assert.equal((await webhook(processedBody, 200)).duplicate, true);
  const processedReview = await db.prepare(`SELECT status, provider_status, processed_at
    FROM payout_reviews WHERE source_id = ?`).bind(webhookReviewId).first();
  assert.equal(processedReview.status, "PAID");
  assert.equal(processedReview.provider_status, "PROCESSED");
  assert.equal(processedReview.processed_at, new Date(processedAt * 1000).toISOString());
  const paidWithdrawal = await db.prepare(`SELECT status, active_lock, paid_at, payout_reference
    FROM withdrawal_requests WHERE source_id = ?`).bind(webhookWithdrawalId).first();
  assert.equal(paidWithdrawal.status, "PAID");
  assert.equal(paidWithdrawal.active_lock, 0);
  assert.equal(paidWithdrawal.payout_reference, webhookPayoutId);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM admin_audit_logs
    WHERE entity_id = ? AND action = 'PAYOUT_WEBHOOK_PROCESSED'`).bind(webhookReviewId).first("count"), 1);

  const reversedBody = { event: "payout.reversed", payload: { payout: {
    id: webhookPayoutId, status: "reversed", amount: 500, currency: "INR",
    created_at: 1_700_000_000, failure_reason: "fixture reversal"
  } } };
  assert.equal((await webhook(reversedBody, 200)).received, "payout.reversed");
  assert.equal((await webhook(reversedBody, 200)).duplicate, true);
  const reversedReview = await db.prepare(`SELECT provider_status, failure_reason
    FROM payout_reviews WHERE source_id = ?`).bind(webhookReviewId).first();
  assert.equal(reversedReview.provider_status, "REVERSED");
  assert.equal(reversedReview.failure_reason, "fixture reversal");
  const reversedWithdrawal = await db.prepare(`SELECT status, active_lock, rejection_reason, metadata
    FROM withdrawal_requests WHERE source_id = ?`).bind(webhookWithdrawalId).first();
  assert.equal(reversedWithdrawal.status, "REJECTED");
  assert.equal(reversedWithdrawal.active_lock, 0);
  assert.equal(reversedWithdrawal.rejection_reason, "Payout reversed: fixture reversal");
  assert.equal(JSON.parse(reversedWithdrawal.metadata).payoutProviderStatus, "REVERSED");
  const missingPayoutBody = { event: "payout.processed", payload: {} };
  await webhook(missingPayoutBody, 400);
  await db.batch([
    db.prepare("DELETE FROM admin_audit_logs WHERE entity_id = ?").bind(webhookReviewId),
    db.prepare("DELETE FROM payout_reviews WHERE source_id = ?").bind(webhookReviewId),
    db.prepare("DELETE FROM withdrawal_requests WHERE source_id = ?").bind(webhookWithdrawalId)
  ]);

  const other = await db.prepare(`SELECT u.source_id FROM users u WHERE u.source_id <> ?1 AND NOT EXISTS (
    SELECT 1 FROM direct_messages m WHERE (m.sender_id = u.source_id AND m.receiver_id = ?1)
      OR (m.sender_id = ?1 AND m.receiver_id = u.source_id)) ORDER BY u.source_id LIMIT 1`)
    .bind(user.source_id).first("source_id");
  const third = await db.prepare("SELECT source_id FROM users WHERE source_id NOT IN (?, ?) ORDER BY source_id LIMIT 1")
    .bind(user.source_id, other).first("source_id");
  const [reportedMessage, unrelated, queueId, chatQueueId, dismissedQueueId] = Array.from({ length: 5 }, id);
  const messageRow = (rowId, target) => db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id,
    message, media_url, media_type, duration, forwarded, is_edited, read, created_at, updated_at, reply_to_message_id,
    reply_to_author, reply_to_text, reply_to_media_url) VALUES (?, ?, ?, 'Fixture direct message', '', '', 0, 0, 0, 0, ?, ?, '', '', '', '')`)
    .bind(rowId, user.source_id, target, time, time);
  const queueRow = (rowId, kind, target) => db.prepare(`INSERT INTO moderation_queues (source_id, target_type,
    target_id, target_user_id, priority, status, created_at) VALUES (?, ?, ?, ?, 'LOW', 'PENDING', ?)`)
    .bind(rowId, kind, target, user.source_id, time);
  await db.batch([
    messageRow(reportedMessage, other), messageRow(unrelated, third), queueRow(queueId, "MESSAGE", reportedMessage),
    queueRow(chatQueueId, "CHAT", `${user.source_id}:${other}`), queueRow(dismissedQueueId, "MESSAGE", reportedMessage)
  ]);
  const dm = "/dm-reviews";
  assert.ok((await json(dm + "?status=PENDING", 200)).dmReviews.some(item => item._id === queueId));
  assert.equal((await json(`${dm}/${queueId}`, 200)).messages[0]._id, reportedMessage);
  await json(`${dm}/${queueId}/warn-user`, 200, "POST", JSON.stringify({ reason: "Fixture message warning" }));
  await json(`${dm}/${queueId}/delete-message/${unrelated}`, 404, "POST", "{}");
  await json(`${dm}/${queueId}/delete-message/${reportedMessage}`, 200, "POST", "{}");
  await json(`${dm}/${dismissedQueueId}/dismiss`, 200, "POST", "{}");
  const replacements = [id(), id()];
  await db.batch(replacements.map(replacement => messageRow(replacement, other)));
  assert.equal((await json(`${dm}/${chatQueueId}`, 200)).messages.length, 2);
  await json(`${dm}/${chatQueueId}/restrict`, 200, "POST", "{}");
  assert.equal((await json(`${dm}/${chatQueueId}`, 200)).messages.length, 0);
  assert.equal(await db.prepare("SELECT source_id FROM direct_messages WHERE source_id = ?").bind(unrelated).first("source_id"), unrelated);
  await db.prepare("DELETE FROM direct_messages WHERE source_id = ?").bind(unrelated).run();

  const reportId = id();
  await db.prepare(`INSERT INTO reports (source_id, reporter_id, target_user_id, reason, evidence, risk_score, status, auto_flagged)
    VALUES (?, ?, ?, 'Fixture report', '{}', 0, 'PENDING', 0)`).bind(reportId, third, user.source_id).run();
  await json(`/reports/${reportId}/dismiss`, 200, "POST", JSON.stringify({ reason: "Fixture dismissed" }));
  assert.equal(await db.prepare("SELECT reviewed_by_admin_id FROM reports WHERE source_id = ?").bind(reportId).first("reviewed_by_admin_id"), adminId);

  const adminPurchase = id();
  await db.prepare(`INSERT INTO purchases (source_id, user_id, provider, status, pack_id, asset_currency,
    coin_amount, diamond_amount, amount_inr, currency, provider_order_id, provider_payment_id, provider_signature, metadata)
    VALUES (?, ?, 'RAZORPAY', 'PENDING', 'fixture', 'COINS', 20, 0, 29, 'INR',
      'order_admin_fixture', 'pay_admin_fixture', 'private-signature', '{}')`).bind(adminPurchase, user.source_id).run();
  const charge = "/payments/recharges/order_admin_fixture";
  const verified = await json(charge + "/verify", 200, "POST", "{}");
  assert.equal(verified.purchase.status, "CREDITED");
  assert.equal(verified.purchase.providerSignature, undefined);
  assert.equal(verified.providerRecord.email, undefined);
  assert.equal(verified.transaction.amount, 20);
  const alreadyCredited = await json(charge + "/credit", 200, "POST", JSON.stringify({ reason: "Fixture reconciliation" }));
  assert.equal(alreadyCredited.transaction._id, verified.transaction._id);
  const beforeRefund = await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(user.source_id).first("wallet_balance");
  const refund = await json(charge + "/refund", 200, "POST", JSON.stringify({ reason: "Fixture refund" }));
  assert.equal(refund.purchase.status, "REFUNDED");
  assert.equal((await json(charge + "/refund", 200, "POST", JSON.stringify({ reason: "Fixture refund retry" }))).alreadyRefunded, true);
  assert.equal(await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(user.source_id).first("wallet_balance"), beforeRefund - 20);
  const googlePurchase = id();
  await db.prepare(`INSERT INTO purchases (source_id, user_id, provider, status, pack_id, asset_currency,
    coin_amount, diamond_amount, amount_inr, currency, google_order_id, purchase_token, metadata)
    VALUES (?, ?, 'GOOGLE_PLAY', 'PAID', 'fixture', 'COINS', 20, 0, 29, 'INR',
      'GPA.ADMIN.REFUND', 'fixture-admin-refund-token', '{}')`).bind(googlePurchase, user.source_id).run();
  const googleRefund = "/payments/recharges/GPA.ADMIN.REFUND/refund";
  const pending = await json(googleRefund, 202, "POST", JSON.stringify({ reason: "Fixture Google Play refund" }));
  assert.equal(pending.purchase.status, "REFUND_PENDING");
  const settled = await json(googleRefund, 200, "POST", JSON.stringify({ reason: "Fixture Google Play refund retry" }));
  assert.equal(settled.purchase.status, "REFUNDED");
  assert.equal(settled.purchase.purchaseToken, undefined);
}
