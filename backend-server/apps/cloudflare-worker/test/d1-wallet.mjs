import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const razorpaySecret = "fixture-razorpay-secret";

export async function verifyD1Wallet(db, request, owner, visitor) {
  const root = "/api/wallet";
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const as = (account, path, status, options = {}) =>
    request(path, status, { accessToken: account.accessToken, ...options });
  const send = (account, path, status, body) => as(account, path, status, { body });
  const balance = async account => db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?")
    .bind(account.user.id).first("wallet_balance");
  const vipExp = async account => db.prepare("SELECT vip_exp FROM users WHERE source_id = ?")
    .bind(account.user.id).first("vip_exp");
  const purchaseCount = async (account, status) => db.prepare(`SELECT COUNT(*) AS count FROM purchases
    WHERE user_id = ? AND (? IS NULL OR status = ?)`).bind(account.user.id, status ?? null, status ?? null)
    .first("count");

  await request(root + "/purchases", 401);
  assert.deepEqual((await as(owner, root + "/purchases", 200)).data.purchases, []);

  // VIP activation debits coins, extends VIP and records the purchase XP receipt.
  await db.prepare("UPDATE users SET wallet_balance = 1500, vip_level = 0, vip_tier = NULL, vip_exp = 0, vip_started_at = NULL, vip_expires_at = NULL WHERE source_id = ?")
    .bind(ownerId).run();
  const activated = await send(owner, root + "/vip/activate", 200, { planId: "vip_7d" });
  assert.equal(activated.data.plan.id, "vip_7d");
  assert.equal(activated.data.xpGrant.event, "VIP_PURCHASE");
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
    WHERE user_id = ? AND source = 'VIP_PURCHASE' AND amount = 299`).bind(ownerId).first("count"), 1);
  const vipAfterActivation = await db.prepare("SELECT vip_level, vip_expires_at FROM users WHERE source_id = ?")
    .bind(ownerId).first();
  assert.ok(vipAfterActivation.vip_level >= 1);
  assert.ok(Date.parse(vipAfterActivation.vip_expires_at) > Date.now());

  // A frozen wallet cannot start a new purchase or a dev recharge.
  await db.prepare("UPDATE user_safety_statuses SET is_wallet_frozen = 1 WHERE user_id = ?").bind(visitorId).run();
  await send(visitor, root + "/vip/activate", 403, { planId: "vip_7d" });
  await send(visitor, root + "/purchases/razorpay/order", 403, { packId: "coins_290", provider: "RAZORPAY" });
  await send(visitor, root + "/dev-recharge", 403, {});
  await db.prepare("UPDATE user_safety_statuses SET is_wallet_frozen = 0 WHERE user_id = ?").bind(visitorId).run();

  // Razorpay checkout creates a pending receipt, then a verified payment credits exactly once.
  const order = (await send(owner, root + "/purchases/razorpay/order", 201,
    { packId: "coins_290", provider: "RAZORPAY" })).data;
  assert.equal(order.purchase.status, "PENDING");
  assert.equal(order.order.id, "order_fixture");
  assert.equal(order.checkout.key, "rzp_test_fixture");
  assert.equal(order.checkout.description, "290 coins");
  assert.equal(await purchaseCount(owner, "PENDING"), 1);

  await send(owner, root + "/purchases/razorpay/verify", 400, {
    purchaseId: order.purchase._id, razorpay_order_id: "wrong_order",
    razorpay_payment_id: "pay_fixture", razorpay_signature: "0".repeat(64)
  });
  const signature = createHmac("sha256", razorpaySecret).update("order_fixture|pay_fixture").digest("hex");
  const expBeforeRazorpay = await vipExp(owner);
  const verified = await send(owner, root + "/purchases/razorpay/verify", 200, {
    purchaseId: order.purchase._id, razorpay_order_id: "order_fixture",
    razorpay_payment_id: "pay_fixture", razorpay_signature: signature
  });
  assert.equal(verified.data.purchase.status, "CREDITED");
  assert.equal(verified.data.purchase.providerPaymentId, "pay_fixture");
  assert.equal(verified.data.balance, await balance(owner));
  assert.equal(await vipExp(owner), expBeforeRazorpay + 3);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
    WHERE user_id = ? AND source = 'RAZORPAY_PURCHASE' AND amount = 290`).bind(ownerId).first("count"), 1);
  const replay = await send(owner, root + "/purchases/razorpay/verify", 200, {
    purchaseId: order.purchase._id, razorpay_order_id: "order_fixture",
    razorpay_payment_id: "pay_fixture", razorpay_signature: signature
  });
  assert.equal(replay.data.purchase.status, "CREDITED");
  assert.equal(replay.data.balance, verified.data.balance);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
    WHERE user_id = ? AND source = 'RAZORPAY_PURCHASE'`).bind(ownerId).first("count"), 1);

  const invalidOrder = (await send(owner, root + "/purchases/razorpay/order", 201,
    { packId: "coins_290", provider: "RAZORPAY" })).data;
  await send(owner, root + "/purchases/razorpay/verify", 400, {
    purchaseId: invalidOrder.purchase._id, razorpay_order_id: "order_fixture_other",
    razorpay_payment_id: "pay_fixture", razorpay_signature: signature
  });

  // Google Play verification claims the token, credits the pack and consumes the purchase once.
  const google = await send(owner, root + "/purchases/google-play/verify", 200, {
    packId: "coins_490", productId: "yugm_coins_490",
    purchaseToken: "fixture-google-token-001", orderId: "GPA.FIXTURE.1"
  });
  assert.equal(google.data.purchase.status, "CREDITED");
  assert.equal(google.data.purchase.googleOrderId, "GPA.FIXTURE.1");
  assert.equal(google.data.purchase.metadata.googleConsumedAt.length, 24);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
    WHERE user_id = ? AND source = 'GOOGLE_PLAY_PURCHASE' AND amount = 490`).bind(ownerId).first("count"), 1);
  const googleReplay = await send(owner, root + "/purchases/google-play/verify", 200, {
    packId: "coins_490", productId: "yugm_coins_490",
    purchaseToken: "fixture-google-token-001"
  });
  assert.equal(googleReplay.data.purchase.metadata.googleConsumedAt, google.data.purchase.metadata.googleConsumedAt);
  await send(visitor, root + "/purchases/google-play/verify", 409, {
    packId: "coins_490", productId: "yugm_coins_490",
    purchaseToken: "fixture-google-token-001"
  });
  await send(owner, root + "/purchases/google-play/verify", 400, {
    packId: "coins_490", productId: "yugm_coins_990",
    purchaseToken: "fixture-google-token-002"
  });

  // Local-only recharge keeps the legacy floor/cap and writes a ledger entry.
  const beforeRecharge = await balance(owner);
  const recharge = await send(owner, root + "/dev-recharge", 200, { amount: 1234.9 });
  assert.equal(recharge.data.balance, beforeRecharge + 1234);
  const beforeVisitorRecharge = await balance(visitor);
  const visitorRecharge = await send(visitor, root + "/dev-recharge", 200, {});
  assert.equal(visitorRecharge.data.balance, beforeVisitorRecharge + 500);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
    WHERE user_id = ? AND source = 'RECHARGE' AND amount = 1234`).bind(ownerId).first("count"), 1);

  const history = (await as(owner, root + "/purchases", 200)).data.purchases;
  assert.ok(history.length >= 3);
  assert.ok(history.every(item => item.userId === ownerId));
  assert.deepEqual((await as(visitor, root + "/purchases", 200)).data.purchases, []);
}
