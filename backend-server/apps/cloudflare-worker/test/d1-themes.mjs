import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

export async function verifyD1Themes(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const key = "theme_midnight";
  const as = (account, path, status, body) => request(path, status, { accessToken: account.accessToken, body });
  const buy = (status, themeKey = key) => as(owner, "/api/themes/purchase", status, { themeKey });
  const equip = (status, themeKey) => as(owner, "/api/user/themes/equip", status, { slot: "profile", themeKey });
  const funds = () => db.prepare("SELECT wallet_balance, xp FROM users WHERE source_id = ?").bind(ownerId).first();
  const ownership = () => db.prepare("SELECT COUNT(*) AS count FROM user_owned_cosmetics WHERE users_id = ? AND value = ?")
    .bind(ownerId, key).first("count");

  await request("/api/themes", 401);
  await request("/api/themes/purchase", 401, { body: {} });
  await as(owner, "/api/user/themes/equip", 422, { slot: "invalid", themeKey: key });
  const catalogs = await Promise.all([as(owner, "/api/themes", 200), as(visitor, "/api/themes", 200)]);
  assert.deepEqual(catalogs[0].data.themes, catalogs[1].data.themes);
  assert.equal(catalogs[0].data.themes.length, 18);
  const midnight = catalogs[0].data.themes.find(theme => theme.key === key);
  assert.deepEqual(midnight.price, { coins: 499, diamonds: 0 });
  assert.deepEqual(midnight.colors, ["#0a0a2e", "#1a1a4e", "#2d1b69"]);
  assert.equal(midnight.animation.config.speed, 0.5);

  await equip(403, key);
  await db.prepare("UPDATE users SET wallet_balance = 0 WHERE source_id = ?").bind(ownerId).run();
  assert.equal((await buy(402)).error.code, "INSUFFICIENT_FUNDS");
  assert.equal(await ownership(), 0);
  await db.prepare("UPDATE users SET wallet_balance = 1000 WHERE source_id = ?").bind(ownerId).run();
  const before = await funds();
  const safetyId = randomBytes(12).toString("hex");
  await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level, warning_count,
    report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen)
    VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1)`).bind(safetyId, ownerId).run();
  assert.equal((await buy(403)).error.message, "Wallet is frozen");
  assert.equal(await ownership(), 0);
  assert.deepEqual(await funds(), before);
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();
  await db.prepare(`CREATE TRIGGER fixture_theme_debit_failure BEFORE INSERT ON wallet_transactions
    WHEN json_extract(NEW.metadata, '$.cosmeticId') = 'theme_midnight'
    BEGIN SELECT RAISE(ABORT, 'fixture theme debit failure'); END`).run();
  await buy(500);
  await db.prepare("DROP TRIGGER fixture_theme_debit_failure").run();
  assert.equal(await ownership(), 0);
  assert.deepEqual(await funds(), before);

  const purchases = await Promise.all([buy(200), buy(200)]);
  assert.deepEqual(purchases.map(result => result.data.theme), [midnight, midnight]);
  assert.equal(await ownership(), 1);
  assert.deepEqual(await funds(), { ...before, wallet_balance: 501 });
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions WHERE user_id = ?
    AND source = 'PROFILE_COSMETIC_PURCHASE' AND json_extract(metadata, '$.cosmeticId') = ?`)
    .bind(ownerId, key).first("count"), 1);
  assert.equal((await equip(200, key)).data.equipped.profile, key);
  const wardrobe = (await as(owner, "/api/user/themes", 200)).data;
  assert.deepEqual(wardrobe.owned, [midnight]);
  assert.equal(wardrobe.equipped.profile, key);
  assert.equal((await equip(200, null)).data.equipped.profile, null);

  await db.prepare("UPDATE immersive_themes SET price_coins = 0 WHERE key = 'theme_cozy'").run();
  const freeKey = "theme_cozy";
  assert.equal((await equip(200, freeKey)).data.equipped.profile, freeKey);
  await buy(200, freeKey);
  assert.deepEqual(await funds(), { ...before, wallet_balance: 501 });
  await db.prepare("UPDATE immersive_themes SET price_coins = 0 WHERE key = 'theme_cosmos'").run();
  assert.equal((await buy(409, "theme_cosmos")).error.message, "This theme cannot be purchased with coins");

  const roomId = randomBytes(12).toString("hex");
  await db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
    max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
    VALUES (?, 'Theme fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 0, 0, 0)`)
    .bind(roomId, ownerId, `theme-${roomId}`).run();
  const room = `/api/rooms/${roomId}`;
  await as(visitor, `${room}/theme`, 403, { themeKey: freeKey });
  assert.equal((await as(owner, `${room}/theme`, 200, { themeKey: key })).data.room.theme, key);
  await as(owner, `${room}/co-host`, 200, { userId: visitor.user.id });
  await as(visitor, `${room}/theme`, 403, { themeKey: key });
  assert.equal((await as(visitor, `${room}/theme`, 200, { themeKey: freeKey })).data.room.theme, freeKey);
  assert.equal((await as(owner, room, 200)).data.room.theme, freeKey);

  await db.prepare("UPDATE immersive_themes SET available = 0").run();
  assert.deepEqual((await as(owner, "/api/themes", 200)).data.themes, []);
  await buy(404);
}
