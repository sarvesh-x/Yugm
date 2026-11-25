import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1GiftCatalog(db, request, owner, visitor) {
  const [gift, expired, disabled, bond, collection, inventory] = Array.from({ length: 6 }, id);
  const past = new Date(Date.now() - 60_000).toISOString();
  await db.batch([
    db.prepare(`INSERT INTO gift_collections (source_id, name, description, icon, bonus_description,
      bonus_xp_multiplier, bonus_coin_multiplier, is_active) VALUES (?, 'Fixture collection', '', '', '', 2, 3, 1)`).bind(collection),
    ...[[gift, "rare", "normal", 1, null], [expired, "rare", "normal", 1, past],
      [disabled, "rare", "normal", 0, null], [bond, "rare", "bonds", 1, null]].map(([key, rarity, category, active, expiry]) =>
      db.prepare(`INSERT INTO gifts (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d,
        interactive, animation_key, expires_at, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
        limited_edition_active, limited_edition_total, limited_edition_remaining, tradable, upgradeable, achievement_gift, pet_gift, vehicle_gift)
        VALUES (?, ?, '✨', 41, 12, 3, ?, '', 0, '', ?, 1, ?, 0, 0, '', ?, 1, 4, 2, 1, 1, 0, 0, 0)`)
        .bind(key, `Fixture gift ${key}`, active, expiry, category, rarity)),
    db.prepare(`INSERT INTO gift_collection_items (source_id, value, gift_collections_id, position) VALUES (?, ?, ?, 0)`)
      .bind(id(), gift, collection),
    db.prepare(`INSERT INTO gift_upgrade_paths (source_id, value, gifts_id, position) VALUES (?, ?, ?, 0)`).bind(id(), disabled, gift),
    db.prepare(`INSERT INTO gift_inventories (source_id, user_id, gift_id, quantity, source, upgrade_level, tradable)
      VALUES (?, ?, ?, 2, 'purchased', 3, 1)`).bind(inventory, owner.user.id, gift)
  ]);
  const as = (account, path, status = 200) => request(path, status, { accessToken: account.accessToken });
  await request("/api/gifts", 401);
  await request("/api/gifts/v2", 401);
  const all = (await as(owner, "/api/gifts")).data.gifts;
  assert.ok(all.some(item => item._id === gift));
  assert.ok(all.every(item => ![expired, disabled, bond].includes(item._id)));
  const filtered = (await as(owner, "/api/gifts/v2?category=normal&rarity=rare&page=1&limit=50")).data;
  const listed = filtered.gifts.find(item => item._id === gift);
  assert.ok(listed);
  assert.equal(listed.coinPrice, 41);
  assert.deepEqual(listed.limitedEdition, { active: true, total: 4, remaining: 2 });
  assert.deepEqual(listed.upgradePath, [disabled]);
  const paged = (await as(owner, "/api/gifts/v2?category=normal&rarity=rare&page=1&limit=1")).data;
  assert.equal(paged.total, filtered.total);
  assert.equal(paged.gifts.length, 1);
  const foundCollection = (await as(owner, "/api/gifts/collections")).data.collections.find(item => item._id === collection);
  assert.deepEqual(foundCollection.gifts, [listed]);
  assert.equal(foundCollection.bonus.xpMultiplier, 2);
  const items = (await as(owner, "/api/inventory")).data.items;
  assert.deepEqual(items.find(item => item.id === inventory), {
    id: inventory, gift: { ...listed, upgradeLevel: 3 }, source: "purchased", quantity: 2, tradable: true, upgradeLevel: 3, upgradeCost: 61
  });
  assert.ok((await as(visitor, "/api/inventory")).data.items.every(item => item.id !== inventory));
}
