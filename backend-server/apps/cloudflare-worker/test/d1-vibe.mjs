import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");
const placeholders = (count) => new Array(count).fill("?").join(", ");

export async function verifyD1Vibe(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;

  async function cleanVibes() {
    const { results } = await db.prepare("SELECT source_id FROM vibe_graphs WHERE user_id IN (?, ?)")
      .bind(ownerId, visitorId).all();
    const ids = results.map((row) => row.source_id);
    const statements = [];
    if (ids.length) {
      statements.push(
        db.prepare(`DELETE FROM vibe_graph_interests WHERE vibe_graphs_id IN (${placeholders(ids.length)})`).bind(...ids),
        db.prepare(`DELETE FROM vibe_graph_languages WHERE vibe_graphs_id IN (${placeholders(ids.length)})`).bind(...ids)
      );
    }
    statements.push(db.prepare("DELETE FROM vibe_graphs WHERE user_id IN (?, ?)").bind(ownerId, visitorId));
    await db.batch(statements);
  }

  async function seed(userId, interests, languages, city) {
    const statements = [
      db.prepare("DELETE FROM user_interests WHERE users_id = ?").bind(userId),
      db.prepare("DELETE FROM user_languages WHERE users_id = ?").bind(userId),
      db.prepare("UPDATE users SET city = ? WHERE source_id = ?").bind(city, userId)
    ];
    interests.forEach((value, position) => statements.push(db.prepare(
      "INSERT INTO user_interests (source_id, value, users_id, position) VALUES (?, ?, ?, ?)")
      .bind(`${userId}:interests:${position}`, value, userId, position)));
    languages.forEach((value, position) => statements.push(db.prepare(
      "INSERT INTO user_languages (source_id, value, users_id, position) VALUES (?, ?, ?, ?)")
      .bind(`${userId}:languages:${position}`, value, userId, position)));
    await db.batch(statements);
  }

  await cleanVibes();
  await seed(ownerId, ["music", "gaming"], ["en", "hi"], "Pune");
  await seed(visitorId, ["music", "travel"], ["en"], "pune");

  for (const path of ["/api/vibe/init", "/api/vibe/update", "/api/vibe/matches", "/api/vibe/preferences"]) {
    await request(path, 401, { body: {} });
  }
  for (const path of [`/api/vibe/match/${visitorId}`, "/api/vibe/graph", "/api/vibe/trend", "/api/vibe/dimensions"]) {
    await request(path, 401);
  }

  assert.equal((await request("/api/vibe/update", 422, {
    accessToken: owner.accessToken, body: { interactionType: "NOPE" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/vibe/match/not-an-id", 400, {
    accessToken: owner.accessToken
  })).error.message, "Invalid user ID");
  assert.equal((await request(`/api/vibe/match/${id()}`, 404, {
    accessToken: owner.accessToken
  })).error.message, "Target user not found");

  assert.equal((await request("/api/vibe/graph", 200, { accessToken: owner.accessToken })).data.vibeGraph, null);
  assert.deepEqual((await request("/api/vibe/trend", 200, { accessToken: owner.accessToken })).data, {
    trend: "stable", history: []
  });
  const initialDimensions = (await request("/api/vibe/dimensions", 200, { accessToken: owner.accessToken })).data.dimensions;
  assert.equal(initialDimensions.length, 8);
  assert.equal(initialDimensions[0].score, 50);

  const initialized = await request("/api/vibe/init", 201, { accessToken: owner.accessToken, body: {} });
  assert.equal(initialized.data.vibe.vibeScore, 50);
  assert.equal(initialized.data.vibe.totalInteractions, 0);
  assert.deepEqual(initialized.data.vibe.interests, ["music", "gaming"]);
  assert.deepEqual(initialized.data.vibe.languages, ["en", "hi"]);
  assert.equal(initialized.data.vibe.city, "Pune");
  const again = await request("/api/vibe/init", 200, { accessToken: owner.accessToken, body: {} });
  assert.equal(again.data.vibe._id, initialized.data.vibe._id);

  const gift = await request("/api/vibe/update", 200, {
    accessToken: owner.accessToken, body: { interactionType: "gift", targetUserId: visitorId }
  });
  assert.equal(gift.data.vibeChange, 5);
  assert.equal(gift.data.vibe.vibeScore, 55);
  assert.equal(gift.data.vibe.totalInteractions, 1);
  assert.equal(gift.data.message, "Your vibe is getting stronger!");
  const joined = await request("/api/vibe/update", 200, {
    accessToken: owner.accessToken, body: { interactionType: "room_join" }
  });
  assert.equal(joined.data.vibeChange, 3);
  assert.equal(joined.data.vibe.vibeScore, 58);
  assert.equal(joined.data.vibe.totalInteractions, 2);

  const match = await request(`/api/vibe/match/${visitorId}`, 200, { accessToken: owner.accessToken });
  assert.equal(match.data.compatibility.score, 74);
  assert.equal(match.data.compatibility.label, "Perfect Match");
  assert.deepEqual(match.data.compatibility.sharedInterests, ["music"]);
  assert.deepEqual(match.data.compatibility.sharedLanguages, ["en"]);
  assert.equal(match.data.compatibility.sameCity, true);
  assert.deepEqual(match.data.vibe, { score: 58, totalInteractions: 2 });
  assert.equal(match.data.targetUser._id, visitorId);
  assert.equal(match.data.targetUser.levelTitle, "New Vibe");

  const matches = await request("/api/vibe/matches?page=1&limit=50", 200, { accessToken: owner.accessToken });
  assert.ok(!matches.data.matches.some((entry) => entry.user._id === ownerId));
  const found = matches.data.matches.find((entry) => entry.user._id === visitorId);
  assert.ok(found);
  assert.equal(found.scores.overall, 74);
  assert.equal(found.scores.compatibility, 74);
  assert.equal(found.scores.interestSimilarity, 74);
  const unpaged = await request("/api/vibe/matches?page=x&limit=x", 200, { accessToken: owner.accessToken });
  assert.ok(unpaged.data.matches.some((entry) => entry.user._id === visitorId));

  const trend = await request("/api/vibe/trend", 200, { accessToken: owner.accessToken });
  assert.equal(trend.data.trend, "up");
  assert.equal(trend.data.history.length, 7);
  assert.equal(trend.data.history.at(-1).score, 58);
  assert.equal(new Set(trend.data.history.map((entry) => entry.date)).size, 7);
  const dimensions = (await request("/api/vibe/dimensions", 200, { accessToken: owner.accessToken })).data.dimensions;
  assert.equal(dimensions.find((entry) => entry.name === "Overall Vibe").score, 58);
  assert.equal(dimensions.find((entry) => entry.name === "Music").score, 70);
  assert.equal(dimensions.find((entry) => entry.name === "Gaming").score, 68);
  assert.equal(dimensions.find((entry) => entry.name === "Language").score, 64);

  await db.prepare("UPDATE vibe_graphs SET vibe_score = 99 WHERE user_id = ?").bind(ownerId).run();
  const capped = await request("/api/vibe/update", 200, {
    accessToken: owner.accessToken, body: { interactionType: "message" }
  });
  assert.equal(capped.data.vibeChange, 2);
  assert.equal(capped.data.vibe.vibeScore, 100);

  const preferences = await request("/api/vibe/preferences", 200, {
    accessToken: visitor.accessToken, body: { dimensions: { overall: 70 } }
  });
  assert.equal(preferences.data.vibeGraph.vibeScore, 0);
  assert.equal(preferences.data.vibeGraph.totalInteractions, 0);
  assert.equal(preferences.data.vibeGraph.city, "");
  assert.equal(preferences.data.vibeGraph.preferences, undefined);
  assert.deepEqual(preferences.data.vibeGraph.interests, []);
  const visitorGraph = await request("/api/vibe/graph", 200, { accessToken: visitor.accessToken });
  assert.equal(visitorGraph.data.vibeGraph._id, preferences.data.vibeGraph._id);
  const visitorUpdate = await request("/api/vibe/update", 200, {
    accessToken: visitor.accessToken, body: { interactionType: "message" }
  });
  assert.equal(visitorUpdate.data.vibe.vibeScore, 2);
  assert.equal(visitorUpdate.data.vibe.totalInteractions, 1);
  const ownerPreferences = await request("/api/vibe/preferences", 200, {
    accessToken: owner.accessToken, body: { dimensions: { overall: 80 } }
  });
  assert.equal(ownerPreferences.data.vibeGraph.vibeScore, 100);

  await cleanVibes();
}
