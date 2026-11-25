import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1DirectGifts(db, request, sender, receiver) {
  const [gift, diamondGift, vipGift, missingGift, blockId, safetyId] = Array.from({ length: 6 }, id);
  const senderId = sender.user.id;
  const receiverId = receiver.user.id;
  const pair = [senderId, receiverId].sort().join(":");
  const stamp = new Date().toISOString();
  const path = "/api/direct-send-gift";
  const giftName = key => `Fixture gift ${key}`;
  const send = (status, data = {}, user = sender) => request(path, status, {
    accessToken: user.accessToken,
    body: { giftId: gift, receiverId, ...data }
  });
  const balances = async user => db.prepare(`SELECT wallet_balance, diamond_balance, wealth_exp, charm_exp, xp, level
    FROM users WHERE source_id = ?`).bind(user).first();
  const giftRow = key => db.prepare("SELECT * FROM gift_transactions WHERE source_id = ?").bind(key).first();
  const ourGiftCount = () => db.prepare(`SELECT COUNT(*) AS count FROM gift_transactions
    WHERE sender_id = ? AND receiver_id = ? AND gift_id IN (?, ?, ?)`)
    .bind(senderId, receiverId, gift, diamondGift, vipGift).first("count");

  await db.batch([
    db.prepare(`UPDATE users SET wallet_balance = 500, diamond_balance = 50, xp = 0, level = 1,
      wealth_exp = 0, charm_exp = 0, last_daily_check_in_at = NULL,
      vip_level = 0, vip_tier = NULL, vip_expires_at = NULL, vip_frozen = 0
      WHERE source_id IN (?, ?)`).bind(senderId, receiverId),
    ...[[gift, "normal", 100, 20], [diamondGift, "normal", 400, 20], [vipGift, "vip", 200, 30]]
      .map(([key, category, coins, diamonds]) => db.prepare(`INSERT INTO gifts
        (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d, interactive,
         animation_key, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
         limited_edition_active, limited_edition_total, limited_edition_remaining, tradable, upgradeable,
         achievement_gift, pet_gift, vehicle_gift)
        VALUES (?, ?, '/assets/fixture-gift.png', ?, 0, ?, 1, '', 0, '', 1, ?, 0, 0, '', 'rare', 0, 0, 0, 0, 0, 0, 0, 0)`)
        .bind(key, giftName(key), coins, diamonds, category)),
    db.prepare("DELETE FROM blocks WHERE blocker_id IN (?, ?) OR blocked_user_id IN (?, ?)")
      .bind(senderId, receiverId, senderId, receiverId),
    db.prepare("DELETE FROM user_safety_statuses WHERE user_id IN (?, ?)").bind(senderId, receiverId),
    db.prepare("DELETE FROM relationships WHERE pair_key = ?").bind(pair),
    db.prepare("DELETE FROM relationship_gift_xp_daily WHERE pair_key = ?").bind(pair),
    db.prepare(`DELETE FROM xp_daily_caps WHERE user_id IN (?, ?)
      AND event IN ('GIFT_SENT', 'GIFT_RECEIVED')`).bind(senderId, receiverId),
    db.prepare(`DELETE FROM gift_transactions WHERE sender_id = ? AND receiver_id = ?
      AND gift_id IN (?, ?, ?)`).bind(senderId, receiverId, gift, diamondGift, vipGift)
  ]);

  await request(path, 401, { body: { giftId: gift, receiverId } });
  assert.equal((await request(path, 422, { accessToken: sender.accessToken,
    body: { giftId: "not-an-id", receiverId } })).error.code, "VALIDATION");
  assert.equal((await send(400, { receiverId: senderId.toUpperCase() })).error.message,
    "Cannot send gifts to yourself");
  assert.equal((await send(404, { giftId: missingGift })).error.message, "Gift or receiver not found");
  assert.equal((await send(404, { receiverId: id() })).error.message, "Gift or receiver not found");
  assert.equal((await send(403, { giftId: vipGift })).error.message, "VIP gifts unlock at VIP 1");

  await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id) VALUES (?, ?, ?)")
    .bind(blockId, receiverId, senderId).run();
  assert.equal((await send(403)).error.message, "Cannot send gifts to this user");
  await db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(blockId).run();

  await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level,
    warning_count, report_count, suspension_count, is_shadow_banned, is_chat_restricted,
    is_room_restricted, is_wallet_frozen, created_at, updated_at)
    VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1, ?, ?)`).bind(safetyId, senderId, stamp, stamp).run();
  assert.equal((await send(403)).error.message, "Wallet is frozen");
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();

  await db.prepare("UPDATE users SET wallet_balance = 0 WHERE source_id = ?").bind(senderId).run();
  assert.equal((await send(402)).error.code, "INSUFFICIENT_FUNDS");
  await db.prepare("UPDATE users SET wallet_balance = 500 WHERE source_id = ?").bind(senderId).run();

  const before = await balances(senderId);
  const giftCountBefore = await ourGiftCount();
  await db.prepare(`CREATE TRIGGER fixture_direct_gift_credit_failure BEFORE INSERT ON wallet_transactions
    WHEN NEW.source = 'GIFT_RECEIVED' AND NEW.user_id = '${receiverId}' BEGIN SELECT RAISE(ABORT, 'fixture gift rollback'); END`).run();
  try {
    await send(500);
    assert.deepEqual(await balances(senderId), before);
    assert.equal(await ourGiftCount(), giftCountBefore);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM direct_messages
      WHERE sender_id = ? AND receiver_id = ? AND message = ?`)
      .bind(senderId, receiverId, `🎁 Sent you a ${giftName(gift)}!`).first("count"), 0);
  } finally {
    await db.prepare("DROP TRIGGER fixture_direct_gift_credit_failure").run();
  }

  const coin = await send(201);
  const transactionId = coin.data.giftTransaction._id;
  assert.equal(coin.data.giftTransaction.currency, "COINS");
  assert.deepEqual([coin.data.giftTransaction.coinAmount, coin.data.giftTransaction.diamondAmount,
    coin.data.giftTransaction.totalValue], [100, 0, 100]);
  assert.equal(coin.data.message.message, `🎁 Sent you a ${giftName(gift)}!`);
  assert.equal(coin.data.message.mediaUrl, "/assets/fixture-gift.png");
  assert.equal(coin.data.message.mediaType, "IMAGE");
  assert.equal(coin.data.message.senderId._id, senderId);
  assert.equal(coin.data.message.receiverId._id, receiverId);
  assert.equal(coin.data.relationship.xp, 25);
  assert.equal(coin.data.xpGrant.sent.xpAwarded, 15);
  assert.equal(coin.data.xpGrant.received.xpAwarded, 10);
  assert.deepEqual(await balances(senderId), { wallet_balance: 400, diamond_balance: 50,
    wealth_exp: 0, charm_exp: 0, xp: 15, level: 1 });
  assert.deepEqual(await balances(receiverId), { wallet_balance: 590, diamond_balance: 50,
    wealth_exp: 0, charm_exp: 100, xp: 10, level: 1 });
  const stored = await giftRow(transactionId);
  assert.equal(stored.sender_id, senderId);
  assert.equal(stored.receiver_id, receiverId);
  assert.equal(stored.gift_id, gift);
  assert.equal(stored.metadata, "{}");
  const debit = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM wallet_transactions
    WHERE user_id = ? AND source = 'GIFT_SENT_DM' AND json_extract(metadata, '$.giftId') = ?`)
    .bind(senderId, gift).first();
  assert.deepEqual([debit.amount, debit.balance_before, debit.balance_after], [100, 500, 400]);
  const credit = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM wallet_transactions
    WHERE user_id = ? AND source = 'GIFT_RECEIVED' AND json_extract(metadata, '$.giftId') = ?`)
    .bind(receiverId, gift).first();
  assert.deepEqual([credit.amount, credit.balance_before, credit.balance_after], [90, 500, 590]);
  assert.equal(JSON.parse(credit.metadata).platformFee, 10);
  for (const [user, event, suffix] of [[senderId, "GIFT_SENT", "sent"], [receiverId, "GIFT_RECEIVED", "received"]]) {
    const grant = await db.prepare("SELECT event, receipt FROM xp_grants WHERE user_id = ? AND action_key = ?")
      .bind(user, `gift:${transactionId}:${suffix}`).first();
    assert.equal(grant.event, event);
    assert.equal(JSON.parse(grant.receipt).event, event);
  }
  assert.ok(await db.prepare("SELECT 1 FROM relationships WHERE pair_key = ? AND xp = 25").bind(pair).first());
  const inbox = await request("/api/users/messages", 200, { accessToken: receiver.accessToken });
  assert.ok(inbox.data.messages.some(message => message._id === coin.data.message._id));
  const notices = await request("/api/notifications?limit=100", 200, { accessToken: receiver.accessToken });
  const giftNotice = notices.data.notifications.find(notice => notice.type === "GIFT"
    && notice.data.partnerId === senderId && notice.body === `${coin.data.message.senderId.name} sent you a ${giftName(gift)}!`);
  assert.equal(giftNotice.title, "Gift Received");

  const diamond = await send(201, { giftId: diamondGift, currency: "DIAMONDS" });
  assert.equal(diamond.data.giftTransaction.currency, "DIAMONDS");
  assert.deepEqual([diamond.data.giftTransaction.coinAmount, diamond.data.giftTransaction.diamondAmount], [0, 20]);
  assert.deepEqual(await balances(senderId), { wallet_balance: 400, diamond_balance: 30,
    wealth_exp: 20, charm_exp: 0, xp: 30, level: 1 });
  assert.deepEqual(await balances(receiverId), { wallet_balance: 590, diamond_balance: 68,
    wealth_exp: 0, charm_exp: 120, xp: 20, level: 1 });
  const diamondDebit = await db.prepare(`SELECT amount, balance_before, balance_after FROM diamond_transactions
    WHERE user_id = ? AND type = 'DEBIT' AND source = 'GIFT_SENT'
      AND json_extract(metadata, '$.giftId') = ?`).bind(senderId, diamondGift).first();
  assert.deepEqual([diamondDebit.amount, diamondDebit.balance_before, diamondDebit.balance_after], [20, 50, 30]);
  const diamondCredit = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM diamond_transactions
    WHERE user_id = ? AND type = 'CREDIT' AND source = 'GIFT_RECEIVED'
      AND json_extract(metadata, '$.giftId') = ?`).bind(receiverId, diamondGift).first();
  assert.deepEqual([diamondCredit.amount, diamondCredit.balance_before, diamondCredit.balance_after], [18, 50, 68]);
  assert.equal(JSON.parse(diamondCredit.metadata).giftValue, 20);
}
