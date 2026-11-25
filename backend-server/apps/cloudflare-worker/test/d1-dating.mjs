import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");
const placeholders = (count) => new Array(count).fill("?").join(", ");

export async function verifyD1Dating(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const pair = [ownerId, visitorId].sort().join(":");
  const notificationTitles = ["It's a Yugm!", "Relationship level up!", "Duo streak!"];

  async function clean({ keepRelationship = false } = {}) {
    const matches = await db.prepare(`SELECT DISTINCT m.source_id FROM matches AS m
      JOIN match_users AS u ON u.matches_id = m.source_id WHERE u.value IN (?, ?)`)
      .bind(ownerId, visitorId).all();
    const statements = [];
    if (matches.results.length) {
      const ids = matches.results.map((row) => row.source_id);
      statements.push(
        db.prepare(`DELETE FROM match_users WHERE matches_id IN (${placeholders(ids.length)})`).bind(...ids),
        db.prepare(`DELETE FROM matches WHERE source_id IN (${placeholders(ids.length)})`).bind(...ids)
      );
    }
    statements.push(
      db.prepare("DELETE FROM likes WHERE liker_id IN (?, ?) OR liked_id IN (?, ?)")
        .bind(ownerId, visitorId, ownerId, visitorId),
      db.prepare(`DELETE FROM notifications WHERE user_id IN (?, ?) AND title IN (${placeholders(notificationTitles.length)})`)
        .bind(ownerId, visitorId, ...notificationTitles),
      db.prepare("DELETE FROM blocks WHERE (blocker_id = ? AND blocked_user_id = ?) OR (blocker_id = ? AND blocked_user_id = ?)")
        .bind(ownerId, visitorId, visitorId, ownerId),
      db.prepare("DELETE FROM user_safety_statuses WHERE user_id IN (?, ?)").bind(ownerId, visitorId),
      db.prepare(`UPDATE users SET interested_in = NULL, looking_for = NULL, dating_age_min = NULL,
        dating_age_max = NULL, dating_verified_only = 0 WHERE source_id IN (?, ?)`).bind(ownerId, visitorId)
    );
    if (!keepRelationship) {
      statements.push(
        db.prepare(`DELETE FROM relationship_users WHERE relationships_id IN
          (SELECT source_id FROM relationships WHERE pair_key = ?)`).bind(pair),
        db.prepare("DELETE FROM relationships WHERE pair_key = ?").bind(pair)
      );
    }
    await db.batch(statements);
  }

  await clean();
  await request("/api/dating/preferences", 401);
  await request("/api/dating/preferences", 401, { body: {}, method: "PUT" });
  await request("/api/dating/like", 401, { body: { likedId: visitorId } });
  await request("/api/dating/pass", 401, { body: { likedId: visitorId } });
  await request("/api/dating/matches", 401);

  assert.equal((await request("/api/dating/preferences", 422, {
    accessToken: owner.accessToken, body: { ...preferences(), datingAgeMin: 40 }, method: "PUT"
  })).error.code, "VALIDATION");
  assert.deepEqual((await request("/api/dating/preferences", 200, {
    accessToken: owner.accessToken
  })).data.preferences, {
    interestedIn: "Everyone", lookingFor: "Friendship", datingAgeMin: 18, datingAgeMax: 35, verifiedOnly: false
  });
  const updatedPreferences = preferences();
  assert.deepEqual((await request("/api/dating/preferences", 200, {
    accessToken: owner.accessToken, body: updatedPreferences, method: "PUT"
  })).data.preferences, updatedPreferences);
  assert.deepEqual((await request("/api/dating/preferences", 200, {
    accessToken: owner.accessToken
  })).data.preferences, updatedPreferences);

  assert.equal((await request("/api/dating/like", 400, {
    accessToken: owner.accessToken, body: { likedId: "not-an-id" }
  })).error.message, "Invalid likedId");
  assert.equal((await request("/api/dating/pass", 400, {
    accessToken: owner.accessToken, body: { likedId: "not-an-id" }
  })).error.message, "Invalid user ID");
  assert.equal((await request("/api/dating/like", 400, {
    accessToken: owner.accessToken, body: { likedId: ownerId }
  })).error.message, "You cannot like yourself");

  const safetyId = id();
  await db.batch([db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level,
    warning_count, report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted,
    is_wallet_frozen, created_at, updated_at) VALUES (?, ?, 100, 'LOW', 0, 0, 0, 1, 0, 0, 0, ?, ?)`)
    .bind(safetyId, ownerId, new Date().toISOString(), new Date().toISOString())]);
  assert.equal((await request("/api/dating/like", 403, {
    accessToken: owner.accessToken, body: { likedId: "not-an-id" }
  })).error.message, "Account restricted");
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();

  assert.match((await request("/api/dating/like", 400, {
    accessToken: owner.accessToken, body: { likedId: visitorId, type: "NOPE" }
  })).error.message, /Like validation failed/);

  const blockId = id();
  await db.batch([db.prepare(`INSERT INTO blocks (source_id, blocker_id, blocked_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`).bind(blockId, ownerId, visitorId, new Date().toISOString(), new Date().toISOString())]);
  assert.equal((await request("/api/dating/like", 403, {
    accessToken: owner.accessToken, body: { likedId: visitorId }
  })).error.message, "Cannot like this user");
  assert.equal((await request("/api/dating/pass", 200, {
    accessToken: owner.accessToken, body: { likedId: visitorId }
  })).data.pass.type, "PASS");
  assert.equal((await request("/api/dating/pass", 400, {
    accessToken: owner.accessToken, body: { likedId: visitorId }
  })).error.message, "Already swiped on this user");
  await clean();

  const firstSwipe = await request("/api/dating/like", 200, {
    accessToken: visitor.accessToken, body: { likedId: ownerId }
  });
  assert.equal(firstSwipe.data.isMatch, false);
  assert.equal(firstSwipe.data.match, null);
  assert.equal(firstSwipe.data.like.likerId, visitorId);
  assert.equal(firstSwipe.data.like.likedId, ownerId);
  assert.equal(firstSwipe.data.like.type, "LIKE");
  assert.ok(firstSwipe.data.like.createdAt);
  assert.equal((await request("/api/dating/like", 400, {
    accessToken: visitor.accessToken, body: { likedId: ownerId }
  })).error.message, "Already swiped on this user");

  const matched = await request("/api/dating/like", 200, {
    accessToken: owner.accessToken, body: { likedId: visitorId }
  });
  assert.equal(matched.data.isMatch, true);
  assert.deepEqual([...matched.data.match.users].sort(), [ownerId, visitorId].sort());
  assert.ok(matched.data.match._id);
  const relationship = await db.prepare(`SELECT xp, level, level_title, streak_days FROM relationships WHERE pair_key = ?`)
    .bind(pair).first();
  assert.deepEqual([relationship.xp, relationship.level, relationship.streak_days], [50, 2, 1]);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM relationship_users WHERE relationships_id = (SELECT source_id FROM relationships WHERE pair_key = ?)")
    .bind(pair).first("count"), 2);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM match_users WHERE matches_id = ?")
    .bind(matched.data.match._id).first("count"), 2);
  for (const userId of [ownerId, visitorId]) {
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND title = ?")
      .bind(userId, "It's a Yugm!").first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND title = 'Relationship level up!'")
      .bind(userId).first("count"), 1);
  }

  const ownerMatches = await request("/api/dating/matches", 200, { accessToken: owner.accessToken });
  assert.equal(ownerMatches.data.matches.length, 1);
  assert.equal(ownerMatches.data.matches[0]._id, matched.data.match._id);
  assert.equal(ownerMatches.data.matches[0].partner._id, visitorId);
  assert.equal(ownerMatches.data.matches[0].relationship.level, 2);
  const visitorMatches = await request("/api/dating/matches", 200, { accessToken: visitor.accessToken });
  assert.equal(visitorMatches.data.matches.length, 1);
  assert.equal(visitorMatches.data.matches[0].partner._id, ownerId);
  await clean();

  await request("/api/dating/like", 200, {
    accessToken: visitor.accessToken, body: { likedId: ownerId, type: "SUPER_LIKE" }
  });
  await request("/api/dating/like", 200, {
    accessToken: owner.accessToken, body: { likedId: visitorId, type: "SUPER_LIKE" }
  });
  const superMatch = await db.prepare("SELECT xp FROM relationships WHERE pair_key = ?").bind(pair).first();
  assert.equal(superMatch.xp, 75);
  await clean();

  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  await db.batch([db.prepare(`INSERT INTO relationships (source_id, pair_key, xp, level, level_title,
    streak_days, last_streak_at, last_interaction_at, created_at, updated_at)
    VALUES (?, ?, 100, 2, 'Good Vibes', 6, ?, ?, ?, ?)`)
    .bind(id(), pair, yesterday, yesterday, yesterday, yesterday)]);
  const seeded = await db.prepare("SELECT xp, level, streak_days, last_streak_at FROM relationships WHERE pair_key = ?")
    .bind(pair).first();
  assert.deepEqual([seeded.xp, seeded.level, seeded.streak_days], [100, 2, 6]);
  await request("/api/dating/like", 200, {
    accessToken: visitor.accessToken, body: { likedId: ownerId }
  });
  await request("/api/dating/like", 200, {
    accessToken: owner.accessToken, body: { likedId: visitorId, type: "SUPER_LIKE" }
  });
  const upgraded = await db.prepare("SELECT xp, level, level_title, streak_days FROM relationships WHERE pair_key = ?")
    .bind(pair).first();
  assert.deepEqual([upgraded.xp, upgraded.level, upgraded.streak_days], [175, 3, 7]);
  for (const userId of [ownerId, visitorId]) {
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND title = 'Relationship level up!'")
      .bind(userId).first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND title = 'Duo streak!'")
      .bind(userId).first("count"), 1);
  }
  await clean();
}

function preferences() {
  return {
    interestedIn: "Everyone", lookingFor: "Dating", datingAgeMin: 21, datingAgeMax: 38, verifiedOnly: true
  };
}
