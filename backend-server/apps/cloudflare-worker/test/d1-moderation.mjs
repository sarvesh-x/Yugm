import assert from "node:assert/strict";

const cleanTextData = {
  text: "hello world",
  context: "chat",
  isClean: true,
  isBlocked: false,
  severity: "LOW",
  keywordFlags: [],
  aiFlags: [],
  toxicityScores: {
    toxicity: 0,
    severeToxicity: 0,
    identityAttack: 0,
    insult: 0,
    threat: 0,
    sexuallyExplicit: 0
  },
  topLabel: null,
  aiModelReady: false,
  aiModelLoading: false
};

const cleanVoiceData = {
  transcript: "hello there",
  isClean: true,
  severity: "LOW",
  keywordFlags: [],
  aiFlags: [],
  toxicityScores: {
    toxicity: 0,
    severeToxicity: 0,
    identityAttack: 0,
    insult: 0,
    threat: 0
  }
};

export async function verifyD1Moderation(db, request, user) {
  const before = await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?")
    .bind(user.user.id).first("count");

  assert.equal((await request("/api/v1/moderation/check-text", 401, { body: { text: "hello" } }))
    .error.code, "UNAUTHORIZED");
  assert.equal((await request("/api/v1/moderation/check-voice", 401, { body: { transcript: "hello" } }))
    .error.code, "UNAUTHORIZED");

  assert.deepEqual((await request("/api/v1/moderation/check-text", 200, {
    accessToken: user.accessToken,
    body: { text: "hello world", ignored: "dropped" }
  })).data, cleanTextData);

  const medium = (await request("/api/v1/moderation/check-text", 200, {
    accessToken: user.accessToken,
    body: { text: "spam scam", context: "message" }
  })).data;
  assert.deepEqual(medium.keywordFlags, ["spam", "scam"]);
  assert.equal(medium.context, "message");
  assert.equal(medium.isClean, false);
  assert.equal(medium.isBlocked, false);
  assert.equal(medium.severity, "MEDIUM");

  const blocked = (await request("/api/v1/moderation/check-text", 200, {
    accessToken: user.accessToken,
    body: { text: "spam scam free coins", context: "profile" }
  })).data;
  assert.deepEqual(blocked.keywordFlags, ["spam", "scam", "free coins"]);
  assert.equal(blocked.isBlocked, true);
  assert.equal(blocked.severity, "HIGH");

  const pattern = (await request("/api/v1/moderation/check-text", 200, {
    accessToken: user.accessToken,
    body: { text: "visit https://t.me/channel" }
  })).data;
  assert.equal(pattern.keywordFlags.length, 1);
  assert.ok(pattern.keywordFlags[0].startsWith("matched pattern:"));
  assert.equal(pattern.severity, "LOW");

  const badContext = await request("/api/v1/moderation/check-text", 500, {
    accessToken: user.accessToken,
    body: { text: "hello", context: "invalid" }
  });
  assert.equal(badContext.error.code, "INTERNAL");
  assert.match(badContext.error.message, /context/);
  assert.ok(badContext.error.requestId);
  const emptyText = await request("/api/v1/moderation/check-text", 500, {
    accessToken: user.accessToken,
    body: { text: "" }
  });
  assert.equal(emptyText.error.code, "INTERNAL");
  assert.match(emptyText.error.message, /text/);

  assert.deepEqual((await request("/api/v1/moderation/check-voice", 200, {
    accessToken: user.accessToken,
    body: { transcript: "hello there" }
  })).data, cleanVoiceData);

  const flaggedVoice = (await request("/api/v1/moderation/check-voice", 200, {
    accessToken: user.accessToken,
    body: { transcript: "buy followers" }
  })).data;
  assert.equal(flaggedVoice.isClean, false);
  assert.deepEqual(flaggedVoice.keywordFlags, ["buy followers"]);
  assert.equal(flaggedVoice.severity, "LOW");

  assert.deepEqual((await request("/api/v1/moderation/check-voice", 400, {
    accessToken: user.accessToken,
    body: {}
  })).error, { message: "Transcript is required" });
  assert.deepEqual((await request("/api/v1/moderation/check-voice", 400, {
    accessToken: user.accessToken,
    body: { transcript: 123 }
  })).error, { message: "Transcript is required" });

  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?")
    .bind(user.user.id).first("count"), before);
}
