import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Wishlist(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const now = new Date().toISOString();
  const publicGift = id();
  const privateGift = id();

  await db.batch([
    ...[publicGift, privateGift].map((gift, index) => db.prepare(`INSERT INTO gifts
      (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d, interactive,
       animation_key, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
       limited_edition_active, limited_edition_total, limited_edition_remaining, tradable, upgradeable,
       achievement_gift, pet_gift, vehicle_gift)
      VALUES (?, ?, '🎁', 100, 1, 1, 1, '', 0, '', 1, 'normal', 0, 0, '', 'common', 0, 0, 0, 1, 0, 0, 0, 0)`)
      .bind(gift, index === 0 ? "Wishlist public gift" : "Wishlist private gift")),
    db.prepare("UPDATE users SET wallet_balance = 0, charm_exp = 0 WHERE source_id = ?").bind(visitorId),
    db.prepare("UPDATE users SET wallet_balance = 1000, charm_exp = 0 WHERE source_id = ?").bind(ownerId)
  ]);

  await request("/api/wishlist", 401, { body: { giftId: publicGift } });
  assert.equal((await request("/api/wishlist", 404, {
    accessToken: owner.accessToken, body: { giftId: id() }
  })).error.message, "Gift not found");
  assert.equal((await request("/api/wishlist", 422, {
    accessToken: owner.accessToken, body: {}
  })).error.code, "VALIDATION");

  const added = await request("/api/wishlist", 200, {
    accessToken: owner.accessToken, body: { giftId: publicGift, message: "  please  " }
  });
  const publicItem = added.data.item;
  assert.equal(publicItem.userId, ownerId);
  assert.equal(publicItem.giftId._id, publicGift);
  assert.equal(publicItem.giftId.name, "Wishlist public gift");
  assert.equal(publicItem.giftId.coinPrice, 100);
  assert.equal(publicItem.message, "please");
  assert.equal(publicItem.isPublic, true);
  assert.equal((await request("/api/wishlist", 409, {
    accessToken: owner.accessToken, body: { giftId: publicGift }
  })).error.message, "Gift already in wishlist");

  const privateItem = (await request("/api/wishlist", 200, {
    accessToken: owner.accessToken, body: { giftId: privateGift, isPublic: false }
  })).data.item;
  assert.equal(privateItem.isPublic, false);
  assert.equal(privateItem.message, undefined);

  await request(`/api/wishlist/${ownerId}`, 401);
  const ownerPublic = (await request(`/api/wishlist/${ownerId}`, 200, {
    accessToken: visitor.accessToken
  })).data.items;
  assert.deepEqual(ownerPublic.map(item => item._id), [publicItem._id]);
  // The legacy router registers /wishlist/:userId before /wishlist/me, so /me resolves as a user id.
  assert.deepEqual((await request("/api/wishlist/me", 200, { accessToken: owner.accessToken })).data.items, []);

  assert.equal((await request(`/api/wishlist/${publicItem._id}`, 404, {
    accessToken: visitor.accessToken, method: "DELETE"
  })).error.message, "Wishlist item not found");
  assert.equal((await request(`/api/wishlist/${id()}`, 404, {
    accessToken: owner.accessToken, method: "DELETE"
  })).error.message, "Wishlist item not found");

  await request(`/api/wishlist/${publicItem._id}/send`, 401, { body: {} });
  assert.equal((await request(`/api/wishlist/${id()}/send`, 404, {
    accessToken: visitor.accessToken, body: {}
  })).error.message, "Wishlist item not found");
  assert.equal((await request(`/api/wishlist/${privateItem._id}/send`, 403, {
    accessToken: visitor.accessToken, body: {}
  })).error.message, "This wishlist item is private");
  assert.equal((await request(`/api/wishlist/${publicItem._id}/send`, 402, {
    accessToken: visitor.accessToken, body: {}
  })).error.code, "INSUFFICIENT_FUNDS");
  assert.equal(await db.prepare("SELECT source_id FROM wishlist_items WHERE source_id = ?")
    .bind(publicItem._id).first("source_id"), publicItem._id);

  const selfSent = await request(`/api/wishlist/${privateItem._id}/send`, 200, {
    accessToken: owner.accessToken, body: {}
  });
  assert.deepEqual(selfSent.data, { sent: true, giftName: "Wishlist private gift" });
  assert.equal(await db.prepare("SELECT source_id FROM wishlist_items WHERE source_id = ?")
    .bind(privateItem._id).first(), null);
  const ownerAfterSelf = await db.prepare("SELECT wallet_balance, charm_exp FROM users WHERE source_id = ?")
    .bind(ownerId).first();
  assert.equal(ownerAfterSelf.wallet_balance, 990);
  assert.equal(ownerAfterSelf.charm_exp, 100);
  const selfTransfer = await db.prepare(`SELECT sender_id, receiver_id, gift_id, coin_amount, diamond_amount,
      currency, type, combo_count, total_value, metadata FROM gift_transactions
    WHERE sender_id = ? AND receiver_id = ? AND gift_id = ?`).bind(ownerId, ownerId, privateGift).first();
  assert.equal(selfTransfer.coin_amount, 100);
  assert.equal(selfTransfer.diamond_amount, 0);
  assert.equal(selfTransfer.currency, "COINS");
  assert.equal(selfTransfer.type, "send");
  assert.equal(selfTransfer.combo_count, 1);
  assert.equal(selfTransfer.total_value, 0);
  assert.deepEqual(JSON.parse(selfTransfer.metadata), {});
  const selfLedger = await db.prepare(`SELECT type, source, amount, balance_before, balance_after, metadata
    FROM wallet_transactions WHERE user_id = ?`).bind(ownerId).all();
  const selfRows = selfLedger.results.slice().sort((left, right) => right.balance_before - left.balance_before);
  assert.deepEqual(selfRows.map(row => [row.type, row.amount, row.balance_before, row.balance_after]), [
    ["DEBIT", 100, 1000, 900],
    ["CREDIT", 90, 900, 990]
  ]);
  assert.equal(JSON.parse(selfRows[1].metadata).platformFee, 10);

  await db.prepare("UPDATE users SET wallet_balance = 500 WHERE source_id = ?").bind(visitorId).run();
  const sent = await request(`/api/wishlist/${publicItem._id}/send`, 200, {
    accessToken: visitor.accessToken, body: {}
  });
  assert.deepEqual(sent.data, { sent: true, giftName: "Wishlist public gift" });
  assert.equal(await db.prepare("SELECT source_id FROM wishlist_items WHERE source_id = ?")
    .bind(publicItem._id).first(), null);
  const balances = await db.batch([
    db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(visitorId),
    db.prepare("SELECT wallet_balance, charm_exp FROM users WHERE source_id = ?").bind(ownerId)
  ]);
  assert.equal(balances[0].results[0].wallet_balance, 400);
  assert.equal(balances[1].results[0].wallet_balance, 1080);
  assert.equal(balances[1].results[0].charm_exp, 200);
  const transfer = await db.prepare(`SELECT sender_id, receiver_id, coin_amount FROM gift_transactions
    WHERE sender_id = ? AND receiver_id = ? AND gift_id = ?`).bind(visitorId, ownerId, publicGift).first();
  assert.equal(transfer.coin_amount, 100);
  await request(`/api/wishlist/${publicItem._id}/send`, 404, { accessToken: visitor.accessToken, body: {} });

  const deletable = (await request("/api/wishlist", 200, {
    accessToken: visitor.accessToken, body: { giftId: publicGift }
  })).data.item;
  assert.equal((await request(`/api/wishlist/${deletable._id}`, 200, {
    accessToken: visitor.accessToken, method: "DELETE"
  })).data.deleted, true);
  assert.equal(await db.prepare("SELECT source_id FROM wishlist_items WHERE source_id = ?")
    .bind(deletable._id).first(), null);
}
