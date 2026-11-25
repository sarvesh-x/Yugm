import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1RoomGifts(db, request, sender, receiver) {
  const [room, item, gift, diamondGift, stockGift, vipGift, recipientSeat] = Array.from({ length: 7 }, id);
  const senderId = sender.user.id;
  const receiverId = receiver.user.id;
  const time = new Date().toISOString();
  const root = `/api/rooms/${room}`;
  const path = `${root}/send-gift`;
  const send = (status, data = {}) => request(path, status, { accessToken: sender.accessToken,
    body: { giftId: gift, receiverId, idempotencyKey: "fixture-gift-coin", ...data } });
  const balances = async user => db.prepare("SELECT wallet_balance, diamond_balance, wealth_exp, charm_exp, xp FROM users WHERE source_id = ?")
    .bind(user).first();
  const stock = async key => db.prepare("SELECT limited_edition_remaining FROM gifts WHERE source_id = ?")
    .bind(key).first("limited_edition_remaining");
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Gift fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PUBLIC', 8, 2, 0, ?, 0, 0, 0)`)
      .bind(room, senderId, `gifts-${room}`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at) VALUES (?, ?, ?, 'HOST', 0, 0, 0, ?),
      (?, ?, ?, 'AUDIENCE', 0, 0, 0, ?)`).bind(id(), room, senderId, time, recipientSeat, room, receiverId, time),
    db.prepare(`UPDATE users SET wallet_balance = 500, diamond_balance = 100, xp = 0, level = 1, wealth_exp = 0, charm_exp = 0,
      vip_level = 0, vip_tier = NULL, vip_expires_at = NULL, vip_frozen = 0
      WHERE source_id IN (?, ?)`).bind(senderId, receiverId),
    ...[[gift, "normal", 1, 1], [diamondGift, "normal", 0, 0], [stockGift, "limited", 1, 1], [vipGift, "vip", 0, 0]]
      .map(([key, category, limited, remaining]) => db.prepare(`INSERT INTO gifts
        (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d, interactive, animation_key,
         combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity, limited_edition_active,
         limited_edition_total, limited_edition_remaining, tradable, upgradeable, achievement_gift, pet_gift, vehicle_gift)
        VALUES (?, ?, '🎁', 100, 0, 20, 1, '', 0, '', 1, ?, 0, 0, '', 'rare', ?, 1, ?, 0, 0, 0, 0, 0)`)
        .bind(key, `Fixture gift ${key}`, category, limited, remaining)),
    db.prepare(`INSERT INTO gift_inventories (source_id, user_id, gift_id, quantity, source, upgrade_level, tradable)
      VALUES (?, ?, ?, 1, 'purchased', 1, 0)`).bind(item, senderId, gift)
  ]);

  await request(path, 401, { body: {} });
  await send(400, { receiverId: senderId.toUpperCase() });
  await send(403, { giftId: vipGift });
  const block = id();
  await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id) VALUES (?, ?, ?)")
    .bind(block, receiverId, senderId).run();
  await send(403);
  await db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(block).run();
  await db.prepare("UPDATE room_participants SET left_at = ? WHERE source_id = ?").bind(time, recipientSeat).run();
  await send(400);
  await db.prepare("UPDATE room_participants SET left_at = NULL WHERE source_id = ?").bind(recipientSeat).run();
  const safety = id();
  await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level, warning_count,
    report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen)
    VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1)`).bind(safety, senderId).run();
  assert.equal((await send(403)).error.message, "Wallet is frozen");
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safety).run();
  await db.prepare("UPDATE users SET wallet_balance = 0 WHERE source_id = ?").bind(senderId).run();
  assert.equal((await send(402)).error.code, "INSUFFICIENT_FUNDS");
  await db.prepare("UPDATE users SET wallet_balance = 500 WHERE source_id = ?").bind(senderId).run();

  const before = await balances(senderId);
  await db.prepare(`CREATE TRIGGER fixture_gift_credit_failure BEFORE INSERT ON wallet_transactions
    WHEN NEW.source = 'GIFT_RECEIVED' BEGIN SELECT RAISE(ABORT, 'fixture gift rollback'); END`).run();
  try {
    await send(500);
    assert.deepEqual(await balances(senderId), before);
    assert.equal(await stock(gift), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM gift_transactions WHERE room_id = ?").bind(room).first("count"), 0);
  } finally {
    await db.prepare("DROP TRIGGER fixture_gift_credit_failure").run();
  }
  const [first, second] = await Promise.all([send([200, 201]), send([200, 201])]);
  assert.equal(first.data.giftTransaction._id, second.data.giftTransaction._id);
  assert.equal([first, second].filter(response => response.data.xpGrant).length, 1);
  assert.equal((await balances(senderId)).wallet_balance, 400);
  assert.equal((await balances(receiverId)).wallet_balance, 590);
  assert.equal((await balances(receiverId)).charm_exp, 100);
  assert.equal(await stock(gift), 0);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
    WHERE json_extract(metadata, '$.giftTransactionId') = ?`).bind(first.data.giftTransaction._id).first("count"), 2);
  await send(409, { inventoryItemId: item });
  const fromInventory = await send(201, { inventoryItemId: item, idempotencyKey: "fixture-gift-inventory" });
  assert.equal(fromInventory.data.giftTransaction.coinAmount, 0);
  assert.equal(fromInventory.data.giftTransaction.totalValue, 100);
  assert.equal((await balances(senderId)).wallet_balance, 400);
  assert.equal((await balances(receiverId)).wallet_balance, 680);
  assert.equal(await db.prepare("SELECT quantity FROM gift_inventories WHERE source_id = ?").bind(item).first(), null);
  assert.equal((await send(200, { inventoryItemId: item, idempotencyKey: "fixture-gift-inventory" }))
    .data.giftTransaction._id, fromInventory.data.giftTransaction._id);
  await send(409, { idempotencyKey: "fixture-gift-after-stock" });

  const diamond = await send(201, { giftId: diamondGift, idempotencyKey: "fixture-gift-diamond", currency: "DIAMONDS" });
  assert.equal(diamond.data.giftTransaction.diamondAmount, 20);
  assert.equal((await balances(senderId)).diamond_balance, 80);
  assert.equal((await balances(receiverId)).diamond_balance, 118);
  assert.equal((await balances(senderId)).wealth_exp, 20);
  assert.equal((await balances(receiverId)).charm_exp, 220);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM diamond_transactions
    WHERE json_extract(metadata, '$.giftTransactionId') = ?`).bind(diamond.data.giftTransaction._id).first("count"), 2);
  const stockRace = await Promise.all([
    send([201, 409], { giftId: stockGift, idempotencyKey: "fixture-gift-stock-a" }),
    send([201, 409], { giftId: stockGift, idempotencyKey: "fixture-gift-stock-b" })
  ]);
  assert.equal(stockRace.filter(result => result.ok).length, 1);
  assert.equal(await stock(stockGift), 0);
  const history = await request(`${root}/messages`, 200, { accessToken: receiver.accessToken });
  assert.equal(history.data.messages.filter(message => message.type === "GIFT").length, 4);
  const activity = await request(`${root}/activity`, 200, { accessToken: receiver.accessToken });
  assert.equal(activity.data.activity.filter(item => item.type === "GIFT").length, 4);
  const inbox = await request("/api/notifications?limit=100", 200, { accessToken: receiver.accessToken });
  assert.equal(inbox.data.notifications.filter(item => item.type === "GIFT" && item.data.roomId === room).length, 4);
}
