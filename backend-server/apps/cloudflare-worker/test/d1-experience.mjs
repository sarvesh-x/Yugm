import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const id = () => randomBytes(12).toString("hex");
const preferences = ["roomInvites", "messages", "gifts", "follows", "hostGoingLive", "wallet", "safety", "marketing"];
const preferenceColumns = preferences.map(key => `notification_preferences_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`);
const profileColumns = ["avatar", "avatar_type", "city", "bio", "xp", "level", "level_title", "last_daily_check_in_at",
  "streak_count", "wallet_balance", "badge_revision", "is_blocked", "muted_until", "suspended_until", "moderation_strikes",
  ...preferenceColumns];

export async function verifyD1Experience(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const achievementId = id();
  const unearnedId = id();
  const bronzeTierId = id();
  const silverTierId = id();
  const unearnedTierId = id();
  const assetId = id();
  const variantId = id();
  const blockId = id();
  const reportId = id();
  const alertId = id();
  const giftId = id();
  const giftTransactionId = id();
  const interestIds = [id(), id(), id()];
  const languageId = id();
  const stamp = new Date().toISOString();
  const badgeIds = [achievementId, unearnedId];

  const originalOwner = await db.prepare(`SELECT ${profileColumns.join(", ")} FROM users WHERE source_id = ?`)
    .bind(ownerId).first();
  assert.ok(originalOwner, "experience fixture owner must exist");
  const originalNulls = await db.prepare("SELECT null_fields FROM user_auth_profile WHERE source_id = ?")
    .bind(ownerId).first("null_fields");
  const originalVisitor = await db.prepare("SELECT name, username FROM users WHERE source_id = ?")
    .bind(visitorId).first();
  assert.ok(originalVisitor, "experience fixture visitor must exist");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const giftBaseline = await db.prepare(`SELECT COALESCE(SUM(coin_amount), 0) AS coins, COUNT(*) AS count,
    COUNT(DISTINCT sender_id) AS supporters FROM gift_transactions
    WHERE receiver_id = ? AND created_at >= ?`).bind(ownerId, since).first();
  const visitorGiftBaseline = await db.prepare(`SELECT COALESCE(SUM(coin_amount), 0) AS coins, COUNT(*) AS count
    FROM gift_transactions WHERE receiver_id = ? AND sender_id = ? AND created_at >= ?`)
    .bind(ownerId, visitorId, since).first();

  await db.batch([
    db.prepare("DELETE FROM asset_variants WHERE assets_id = ?").bind(assetId),
    db.prepare("DELETE FROM assets WHERE source_id = ?").bind(assetId),
    db.prepare("DELETE FROM achievement_tiers WHERE source_id IN (?, ?, ?)").bind(bronzeTierId, silverTierId, unearnedTierId),
    db.prepare("DELETE FROM achievements WHERE source_id IN (?, ?)").bind(achievementId, unearnedId),
    db.prepare("DELETE FROM wallet_transactions WHERE json_extract(metadata, '$.achievementId') IN (?, ?)")
      .bind(achievementId, unearnedId),
    db.prepare("DELETE FROM notifications WHERE json_extract(data, '$.achievementId') IN (?, ?) OR source_id = ?")
      .bind(achievementId, unearnedId, alertId),
    db.prepare("DELETE FROM user_badge_grants WHERE badge_id IN (?, ?)").bind(...badgeIds),
    db.prepare("DELETE FROM user_showcased_badges WHERE value IN (?, ?)").bind(...badgeIds),
    db.prepare("DELETE FROM user_owned_cosmetics WHERE value = ?").bind("experience_frame"),
    db.prepare("DELETE FROM user_claimed_achievement_tiers WHERE achievement_id IN (?, ?)").bind(...badgeIds),
    db.prepare("DELETE FROM user_claimed_achievements WHERE value IN (?, ?)").bind(...badgeIds),
    db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(blockId),
    db.prepare("DELETE FROM reports WHERE source_id = ?").bind(reportId),
    db.prepare("DELETE FROM gift_transactions WHERE source_id = ?").bind(giftTransactionId),
    db.prepare("DELETE FROM gifts WHERE source_id = ?").bind(giftId),
    db.prepare("DELETE FROM user_interests WHERE source_id IN (?, ?, ?)").bind(...interestIds),
    db.prepare("DELETE FROM user_languages WHERE source_id = ?").bind(languageId)
  ]);

  try {
    await db.batch([
      db.prepare(`UPDATE users SET avatar = ?, avatar_type = 'UPLOADED', city = 'Fixture City', bio = 'Fixture bio',
        xp = 100, level = 2, level_title = 'Fixture Level', last_daily_check_in_at = ?, streak_count = 3,
        wallet_balance = ?, badge_revision = NULL, is_blocked = 0, muted_until = NULL, suspended_until = NULL,
        moderation_strikes = 0, notification_preferences_room_invites = 1, notification_preferences_messages = 1,
        notification_preferences_gifts = 1, notification_preferences_follows = 1,
        notification_preferences_host_going_live = 1, notification_preferences_wallet = 1,
        notification_preferences_safety = 1, notification_preferences_marketing = 0 WHERE source_id = ?`)
        .bind("https://experience.fixture/owner.png", stamp, originalOwner.wallet_balance, ownerId),
      db.prepare("UPDATE user_auth_profile SET null_fields = '[]' WHERE source_id = ?").bind(ownerId),
      db.prepare("INSERT OR IGNORE INTO user_auth_profile (source_id, null_fields, missing_fields) VALUES (?, '[]', '[]')")
        .bind(ownerId),
      ...interestIds.map((rowId, position) => db.prepare(`INSERT INTO user_interests
        (source_id, value, users_id, position) VALUES (?, ?, ?, ?)`)
        .bind(rowId, `interest-${position}`, ownerId, position)),
      db.prepare("INSERT INTO user_languages (source_id, value, users_id, position) VALUES (?, 'english', ?, 0)")
        .bind(languageId, ownerId),
      db.prepare(`INSERT INTO assets (source_id, owner_type, owner_id, kind, status, version, original_name,
        mime_type, bytes, width, height, sha256, staging_key, staging_url, public_key, public_url, created_by,
        published_at, created_at, updated_at)
        VALUES (?, 'badge', ?, 'IMAGE', 'published', 2, 'badge.png', 'image/png', 1024, 64, 64, ?, '', '',
        'badge/key', 'https://experience.fixture/badge.png', 'fixture', ?, ?, ?)`)
        .bind(assetId, achievementId, "a".repeat(64), stamp, stamp, stamp),
      db.prepare(`INSERT INTO asset_variants (source_id, name, key, url, content_type, bytes, width, height, assets_id, position)
        VALUES (?, 'full', 'badge/key', 'https://experience.fixture/badge-full.png', 'image/png', 1024, 64, 64, ?, 0)`)
        .bind(variantId, assetId),
      db.prepare(`INSERT INTO achievements (source_id, "id", title, description, category, icon, image_url,
        asset_ref, kind, metric, weekly_target, hidden, "order", created_at, updated_at)
        VALUES (?, ?, 'Fixture Badge', 'A locally seeded achievement', 'CONTENT', 'sparkles',
        'https://legacy.fixture/badge.png', ?, 'ACHIEVEMENT', 'profile_complete', NULL, 0, 9001, ?, ?)`)
        .bind(achievementId, achievementId, assetId, stamp, stamp),
      db.prepare(`INSERT INTO achievement_tiers (source_id, tier, target, reward_coins, reward_cosmetic, achievements_id, position)
        VALUES (?, 'BRONZE', 60, 25, 'experience_frame', ?, 0)`).bind(bronzeTierId, achievementId),
      db.prepare(`INSERT INTO achievement_tiers (source_id, tier, target, reward_coins, reward_cosmetic, achievements_id, position)
        VALUES (?, 'SILVER', 100, 50, NULL, ?, 1)`).bind(silverTierId, achievementId),
      db.prepare(`INSERT INTO achievements (source_id, "id", title, description, category, icon, image_url,
        asset_ref, kind, metric, weekly_target, hidden, "order", created_at, updated_at)
        VALUES (?, ?, 'Unearned Badge', 'Not earned by the fixture user', 'SOCIAL', 'users', NULL, NULL,
        'ACHIEVEMENT', 'follow_10', NULL, 0, 9002, ?, ?)`).bind(unearnedId, unearnedId, stamp, stamp),
      db.prepare(`INSERT INTO achievement_tiers (source_id, tier, target, reward_coins, reward_cosmetic, achievements_id, position)
        VALUES (?, 'BRONZE', 100, 0, NULL, ?, 0)`).bind(unearnedTierId, unearnedId),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        VALUES (?, ?, 'SYSTEM', 'Fixture safety alert', 'Review your safety checklist', ?, 0, ?, ?)`)
        .bind(alertId, ownerId, JSON.stringify({ fixture: alertId }), stamp, stamp),
      db.prepare(`INSERT INTO gifts (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d,
        interactive, animation_key, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
        limited_edition_active, limited_edition_total, limited_edition_remaining, tradable, upgradeable,
        achievement_gift, pet_gift, vehicle_gift, created_at, updated_at)
        VALUES (?, 'Experience gift', 'gift', 120, 0, 0, 1, 'fixture', 1, 'fixture', 1, 'normal', 0, 0,
        'fixture', 'common', 0, 0, 0, 1, 0, 0, 0, 0, ?, ?)`).bind(giftId, stamp, stamp),
      db.prepare(`INSERT INTO gift_transactions (source_id, sender_id, receiver_id, gift_id, coin_amount,
        diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, 120, 0, 'COINS', 'send', 1, 120, 'fixture', '{}', ?, ?)`)
        .bind(giftTransactionId, visitorId, ownerId, giftId, stamp, stamp)
    ]);

    for (const path of ["/api/experience/notification-preferences", "/api/experience/achievements",
      "/api/experience/badges", "/api/experience/safety-center", "/api/experience/creator-dashboard",
      "/api/experience/home"]) {
      assert.equal((await request(path, 401)).error.code, "UNAUTHORIZED");
    }
    assert.equal((await request("/api/experience/notification-preferences", 401, {
      body: { roomInvites: false }
    })).error.code, "UNAUTHORIZED");
    assert.equal((await request("/api/experience/notification-preferences", 422, {
      accessToken: owner.accessToken, method: "PUT", body: { roomInvites: "yes" }
    })).error.code, "VALIDATION");
    assert.equal((await request("/api/experience/badges/showcase", 422, {
      accessToken: owner.accessToken, method: "PUT", body: { badgeIds: [achievementId, achievementId] }
    })).error.code, "VALIDATION");
    assert.equal((await request("/api/experience/achievements/claim", 500, {
      accessToken: owner.accessToken, body: {}
    })).error.code, "INTERNAL");

    const initialPreferences = (await request("/api/experience/notification-preferences", 200, {
      accessToken: owner.accessToken
    })).data.preferences;
    assert.equal(initialPreferences.marketing, false);
    const updatedPreferences = (await request("/api/experience/notification-preferences", 200, {
      accessToken: owner.accessToken, method: "PUT", body: { marketing: true, messages: false }
    })).data.preferences;
    assert.equal(updatedPreferences.marketing, true);
    assert.equal(updatedPreferences.messages, false);
    assert.deepEqual((await request("/api/experience/notification-preferences", 200, {
      accessToken: owner.accessToken
    })).data.preferences, updatedPreferences);

    const initialAchievements = (await request("/api/experience/achievements", 200, {
      accessToken: owner.accessToken
    })).data;
    assert.equal(initialAchievements.schemaVersion, 1);
    const initialBadge = initialAchievements.achievements.find(item => item.id === achievementId);
    assert.equal(initialBadge.progress, 60);
    assert.equal(initialBadge.total, 60);
    assert.equal(initialBadge.currentTier, "SILVER");
    assert.equal(initialBadge.canClaim, true);
    assert.equal(initialBadge.tiers[0].rewardCosmetic, "experience_frame");

    assert.equal((await request(`/api/experience/achievements/${achievementId}/share`, 403, {
      accessToken: owner.accessToken, method: "POST"
    })).error.message, "Claim this achievement before sharing it");
    assert.equal((await request("/api/experience/achievements/claim", 404, {
      accessToken: owner.accessToken, body: { achievementId: "missing-achievement" }
    })).error.message, "Achievement not found");

    const bronze = (await request("/api/experience/achievements/claim", 200, {
      accessToken: owner.accessToken, body: { achievementId }
    })).data;
    assert.deepEqual(bronze, { claimed: true, tier: "BRONZE", rewardCoins: 25, rewardCosmetic: "experience_frame" });

    const silverAttempts = await Promise.all([1, 2].map(() => request("/api/experience/achievements/claim", [200, 409], {
      accessToken: owner.accessToken, body: { achievementId }
    })));
    const silverClaim = silverAttempts.find(item => item.data?.claimed);
    const replay = silverAttempts.find(item => item.error);
    assert.ok(silverClaim, "one concurrent final-tier claim must commit");
    assert.ok(replay, "the replayed final-tier claim must conflict");
    assert.equal(silverClaim.data.tier, "SILVER");
    assert.equal(silverClaim.data.rewardCoins, 50);
    assert.equal(silverClaim.data.rewardCosmetic, undefined);
    assert.equal(replay.error.code, "CONFLICT");
    assert.match(replay.error.message, /already.*claimed/i);

    const claimedRows = await db.prepare(`SELECT tier, COUNT(*) AS count FROM user_claimed_achievement_tiers
      WHERE users_id = ? AND achievement_id = ? GROUP BY tier`).bind(ownerId, achievementId).all();
    assert.deepEqual(claimedRows.results.map(row => [row.tier, row.count]), [["BRONZE", 1], ["SILVER", 1]]);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
      WHERE user_id = ? AND json_extract(metadata, '$.achievementId') = ?`).bind(ownerId, achievementId).first("count"), 2);
    assert.equal(await db.prepare(`SELECT SUM(amount) AS total FROM wallet_transactions
      WHERE user_id = ? AND json_extract(metadata, '$.achievementId') = ?`).bind(ownerId, achievementId).first("total"), 75);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM user_owned_cosmetics
      WHERE users_id = ? AND value = 'experience_frame'`).bind(ownerId).first("count"), 1);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND type = 'SYSTEM'
      AND json_extract(data, '$.achievementId') = ?`).bind(ownerId, achievementId).first("count"), 2);
    assert.equal(await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(ownerId).first("wallet_balance"),
      originalOwner.wallet_balance + 75);

    const shared = (await request(`/api/experience/achievements/${achievementId}/share`, 200, {
      accessToken: owner.accessToken, method: "POST"
    })).data;
    assert.match(shared.shareText, /Fixture Badge.*SILVER/s);
    assert.deepEqual(shared.achievement, { id: achievementId, title: "Fixture Badge", tier: "SILVER", icon: "sparkles" });

    const gallery = (await request("/api/experience/badges", 200, { accessToken: owner.accessToken })).data;
    assert.equal(gallery.capacity, 5);
    assert.equal(gallery.wornIds.includes(achievementId), false);
    assert.equal(gallery.user.name, owner.user.name);
    assert.equal(gallery.user.avatarType, "UPLOADED");
    const galleryBadge = gallery.badges.find(item => item.id === achievementId);
    assert.equal(galleryBadge.unlocked, true);
    assert.equal(galleryBadge.tier, "SILVER");
    assert.equal(galleryBadge.imageUrl, "https://experience.fixture/badge.png");
    assert.equal(galleryBadge.assetId, assetId);
    assert.equal(galleryBadge.assetVersion, 2);
    assert.deepEqual(galleryBadge.assetVariants.map(item => item.name), ["full"]);
    assert.equal(gallery.badges.find(item => item.id === unearnedId).unlocked, false);

    assert.equal((await request("/api/experience/badges/showcase", 400, {
      accessToken: owner.accessToken, method: "PUT", body: { badgeIds: [unearnedId] }
    })).error.message, "Only earned, active badges can be worn");
    const showcased = (await request("/api/experience/badges/showcase", 200, {
      accessToken: owner.accessToken, method: "PUT", body: { badgeIds: [achievementId] }
    })).data;
    assert.deepEqual(showcased.badgeIds, [achievementId]);
    const selfShowcase = (await request(`/api/experience/badges/showcase/${ownerId}`, 200, {
      accessToken: owner.accessToken
    })).data;
    assert.deepEqual(selfShowcase.badges.map(item => item.id), [achievementId]);
    const otherShowcase = (await request(`/api/experience/badges/showcase/${ownerId}`, 200, {
      accessToken: visitor.accessToken
    })).data;
    assert.deepEqual(otherShowcase.badges.map(item => item.id), [achievementId]);
    assert.equal((await request("/api/experience/badges/showcase/bad-id", 400, {
      accessToken: visitor.accessToken
    })).error.message, "Invalid user ID");
    assert.equal((await request(`/api/experience/badges/showcase/${id()}`, 404, {
      accessToken: visitor.accessToken
    })).error.message, "User not found");

    const dashboard = (await request("/api/experience/creator-dashboard", 200, {
      accessToken: owner.accessToken
    })).data;
    assert.equal(dashboard.windowDays, 30);
    assert.equal(dashboard.summary.giftCoins, Number(giftBaseline.coins) + 120);
    assert.equal(dashboard.summary.giftCount, Number(giftBaseline.count) + 1);
    assert.ok(dashboard.summary.uniqueSupporters >= Number(giftBaseline.supporters));
    assert.equal(dashboard.summary.estimatedInr,
      Math.round((Number(giftBaseline.coins) + 120) * 0.01 * 100) / 100);
    const supporter = dashboard.topSupporters.find(item => item._id === visitorId);
    assert.ok(supporter, "the fixture supporter must appear in the creator dashboard");
    assert.equal(supporter.coins, Number(visitorGiftBaseline.coins) + 120);
    assert.equal(supporter.gifts, Number(visitorGiftBaseline.count) + 1);
    assert.equal(supporter.user._id, visitorId);
    assert.equal(dashboard.gifts.find(item => item._id === giftTransactionId).giftId.name, "Experience gift");

    const home = (await request("/api/experience/home", 200, { accessToken: owner.accessToken })).data;
    assert.equal(home.schemaVersion, 1);
    assert.equal(home.profileCompletion.percent, 100);
    assert.equal(home.quickActions.length, 4);
    assert.equal(home.achievements.length, 2);
    assert.ok(home.notifications.unreadCount >= 1);
    assert.ok(home.notifications.recent.some(item => item._id === alertId));
    assert.ok(home.people.suggestedHosts.some(item => item.id === visitorId));
    assert.deepEqual((await request("/api/experience/home", 200, { accessToken: owner.accessToken })).data, home);

    await db.batch([
      db.prepare(`INSERT INTO blocks (source_id, blocker_id, blocked_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`).bind(blockId, ownerId, visitorId, stamp, stamp),
      db.prepare(`INSERT INTO reports (source_id, reporter_id, target_user_id, reason, description, evidence,
        risk_score, auto_flagged, status, created_at, updated_at)
        VALUES (?, ?, ?, 'spam', 'fixture', '[]', 0, 0, 'PENDING', ?, ?)`)
        .bind(reportId, ownerId, visitorId, stamp, stamp)
    ]);
    const safety = (await request("/api/experience/safety-center", 200, { accessToken: owner.accessToken })).data;
    assert.equal(safety.trust.label, "Good standing");
    assert.deepEqual(safety.checklist.map(item => [item.id, item.done]), [
      ["block", true], ["report", true], ["privacy", true], ["alerts", false]
    ]);
    const fixtureBlock = safety.blockedUsers.find(item => item._id === blockId);
    assert.ok(fixtureBlock, "the fixture block must appear in the safety center");
    assert.equal(fixtureBlock.blockedUserId._id, visitorId);
    assert.equal(fixtureBlock.__v, 0);

    // Home syncs badges without blocking its response; let that write settle
    // before restoring the fixture's authoritative user rows.
    await delay(25);
  } finally {
    await db.batch([
      db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(blockId),
      db.prepare("DELETE FROM reports WHERE source_id = ?").bind(reportId),
      db.prepare("DELETE FROM asset_variants WHERE assets_id = ?").bind(assetId),
      db.prepare("DELETE FROM assets WHERE source_id = ?").bind(assetId),
      db.prepare("DELETE FROM achievement_tiers WHERE source_id IN (?, ?, ?)").bind(bronzeTierId, silverTierId, unearnedTierId),
      db.prepare("DELETE FROM achievements WHERE source_id IN (?, ?)").bind(...badgeIds),
      db.prepare("DELETE FROM wallet_transactions WHERE json_extract(metadata, '$.achievementId') IN (?, ?)")
        .bind(...badgeIds),
      db.prepare("DELETE FROM notifications WHERE json_extract(data, '$.achievementId') IN (?, ?) OR source_id = ?")
        .bind(...badgeIds, alertId),
      db.prepare("DELETE FROM user_badge_grants WHERE badge_id IN (?, ?)").bind(...badgeIds),
      db.prepare("DELETE FROM user_showcased_badges WHERE value IN (?, ?)").bind(...badgeIds),
      db.prepare("DELETE FROM user_owned_cosmetics WHERE value = ?").bind("experience_frame"),
      db.prepare("DELETE FROM user_claimed_achievement_tiers WHERE achievement_id IN (?, ?)").bind(...badgeIds),
      db.prepare("DELETE FROM user_claimed_achievements WHERE value IN (?, ?)").bind(...badgeIds),
      db.prepare("DELETE FROM gift_transactions WHERE source_id = ?").bind(giftTransactionId),
      db.prepare("DELETE FROM gifts WHERE source_id = ?").bind(giftId),
      db.prepare("DELETE FROM user_interests WHERE source_id IN (?, ?, ?)").bind(...interestIds),
      db.prepare("DELETE FROM user_languages WHERE source_id = ?").bind(languageId),
      db.prepare(`UPDATE users SET avatar = ?, avatar_type = ?, city = ?, bio = ?, xp = ?, level = ?, level_title = ?,
        last_daily_check_in_at = ?, streak_count = ?, wallet_balance = ?, badge_revision = ?, is_blocked = ?,
        muted_until = ?, suspended_until = ?, moderation_strikes = ?, ${preferenceColumns.map(column => `${column} = ?`).join(", ")}
        WHERE source_id = ?`)
        .bind(...profileColumns.map(column => originalOwner[column]), ownerId),
      originalNulls === undefined
        ? db.prepare("DELETE FROM user_auth_profile WHERE source_id = ?").bind(ownerId)
        : db.prepare("UPDATE user_auth_profile SET null_fields = ? WHERE source_id = ?").bind(originalNulls, ownerId)
    ]);
  }
}
