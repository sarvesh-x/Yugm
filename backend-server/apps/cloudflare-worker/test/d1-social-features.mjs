import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");
const avatarParts = ["background", "clothes", "head", "mouth", "eyes", "top"];
const avatarColumns = ["avatar", "avatar_type", "level", "level_title",
  ...avatarParts.map(key => `avatar_parts_${key}`)];

export async function verifyD1SocialFeatures(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const users = [ownerId, visitorId];
  const userMarks = "?, ?";
  const moodId = id();
  const unreadWaveId = id();
  const readWaveId = id();
  const questionId = id();
  const seededPollId = id();
  const ownedPollId = id();
  const optionIds = [id(), id()];
  const countdownId = id();
  const expiredCountdownId = id();
  const inactiveCountdownId = id();
  const startedAt = new Date().toISOString();
  const createdAt = new Date().toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const unreadCreated = new Date(Date.parse(createdAt) - 1_000).toISOString();
  const readCreated = new Date(Date.parse(createdAt) - 2_000).toISOString();
  const localDay = new Date();
  localDay.setHours(0, 0, 0, 0);
  const day = localDay.toISOString();
  let sentWaveId;

  const originals = await Promise.all(users.map(userId => db.prepare(
    `SELECT source_id, name, username, ${avatarColumns.join(", ")} FROM users WHERE source_id = ?`).bind(userId).first()));
  const beforeNotifications = await db.prepare(`SELECT COUNT(*) AS count FROM notifications
    WHERE user_id IN (${userMarks})`).bind(...users).first("count");

  await db.batch([
    db.prepare(`DELETE FROM user_moods WHERE user_id IN (${userMarks})`).bind(...users),
    db.prepare(`DELETE FROM wave_nudges WHERE sender_id IN (${userMarks}) OR receiver_id IN (${userMarks})`)
      .bind(...users, ...users),
    db.prepare(`DELETE FROM notifications WHERE created_at >= ? AND type = 'WAVE'
      AND user_id IN (${userMarks}) AND json_extract(data, '$.senderId') IN (${userMarks})`)
      .bind(startedAt, ...users, ...users),
    db.prepare("DELETE FROM user_daily_answers WHERE question_id = ?").bind(questionId),
    db.prepare("DELETE FROM daily_questions WHERE source_id = ?").bind(questionId),
    db.prepare(`DELETE FROM voice_poll_votes WHERE voice_polls_id IN (?, ?)`)
      .bind(seededPollId, ownedPollId),
    db.prepare(`DELETE FROM voice_poll_ballots WHERE voice_polls_id IN (?, ?)`)
      .bind(seededPollId, ownedPollId),
    db.prepare(`DELETE FROM voice_poll_options WHERE voice_polls_id IN (?, ?)`)
      .bind(seededPollId, ownedPollId),
    db.prepare("DELETE FROM voice_polls WHERE source_id IN (?, ?)").bind(seededPollId, ownedPollId),
    db.prepare("DELETE FROM countdown_events WHERE source_id IN (?, ?, ?)")
      .bind(countdownId, expiredCountdownId, inactiveCountdownId)
  ].map(statement => statement));

  try {
    const setup = [
      db.prepare(`UPDATE users SET avatar = ?, avatar_type = ?, level = ?, level_title = ?,
        avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = ?,
        avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL
        WHERE source_id = ?`).bind("https://social.fixture/owner.png", "UPLOADED", 6, "Social", 2, ownerId),
      db.prepare(`UPDATE users SET avatar = NULL, avatar_type = NULL, level = ?, level_title = ?,
        avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = NULL,
        avatar_parts_mouth = NULL, avatar_parts_eyes = 4, avatar_parts_top = NULL
        WHERE source_id = ?`).bind(3, "Member", visitorId),
      db.prepare(`INSERT INTO user_moods (source_id, user_id, mood, emoji, activity, activity_room_id,
        activity_room_id_present, is_active, expires_at, created_at, updated_at)
        VALUES (?, ?, 'happy', '😊', 'Chatting', NULL, 0, 1, ?, ?, ?)`)
        .bind(moodId, ownerId, future, createdAt, createdAt),
      db.prepare(`INSERT INTO wave_nudges (source_id, sender_id, receiver_id, type, read, room_id, created_at, updated_at)
        VALUES (?, ?, ?, 'wave', 0, NULL, ?, ?)`).bind(unreadWaveId, visitorId, ownerId, unreadCreated, unreadCreated),
      db.prepare(`INSERT INTO wave_nudges (source_id, sender_id, receiver_id, type, read, room_id, created_at, updated_at)
        VALUES (?, ?, ?, 'nudge', 1, NULL, ?, ?)`).bind(readWaveId, visitorId, ownerId, readCreated, readCreated),
      db.prepare(`INSERT INTO daily_questions (source_id, question, category, date, is_active, created_at, updated_at)
        VALUES (?, 'Fixture question', 'general', ?, 1, ?, ?)`).bind(questionId, day, createdAt, createdAt),
      db.prepare(`INSERT INTO voice_polls (source_id, user_id, question, audio_url, duration, is_active,
        expires_at, created_at, updated_at) VALUES (?, ?, 'Fixture poll', 'https://social.fixture/poll.mp3', 12, 1, ?, ?, ?)`)
        .bind(seededPollId, visitorId, future, createdAt, createdAt),
      db.prepare(`INSERT INTO voice_poll_options (source_id, text, audio_url, votes, voice_polls_id, position)
        VALUES (?, 'One', 'https://social.fixture/one.mp3', 2, ?, 0)`).bind(optionIds[0], seededPollId),
      db.prepare(`INSERT INTO voice_poll_options (source_id, text, audio_url, votes, voice_polls_id, position)
        VALUES (?, 'Two', NULL, 0, ?, 1)`).bind(optionIds[1], seededPollId),
      db.prepare(`INSERT INTO voice_poll_votes (source_id, value, voice_polls_id, position)
        VALUES (?, ?, ?, 0)`).bind(id(), ownerId, seededPollId),
      db.prepare(`INSERT INTO voice_poll_ballots (source_id, user_id, option_index, voice_polls_id, position)
        VALUES (?, ?, 0, ?, 0)`).bind(id(), ownerId, seededPollId),
      db.prepare(`INSERT INTO voice_polls (source_id, user_id, question, audio_url, duration, is_active,
        expires_at, created_at, updated_at) VALUES (?, ?, 'Owned poll', '', 0, 1, ?, ?, ?)`)
        .bind(ownedPollId, ownerId, future, future, future),
      db.prepare(`INSERT INTO voice_poll_options (source_id, text, audio_url, votes, voice_polls_id, position)
        VALUES (?, 'Yes', NULL, 0, ?, 0)`).bind(id(), ownedPollId),
      db.prepare(`INSERT INTO voice_poll_options (source_id, text, audio_url, votes, voice_polls_id, position)
        VALUES (?, 'No', NULL, 0, ?, 1)`).bind(id(), ownedPollId),
      db.prepare(`INSERT INTO countdown_events (source_id, title, description, target_date, type, cover_image,
        color, is_active, created_at, updated_at) VALUES (?, 'Fixture countdown', 'desc', ?, 'festival', NULL, '#112233', 1, ?, ?)`)
        .bind(countdownId, future, createdAt, createdAt),
      db.prepare(`INSERT INTO countdown_events (source_id, title, description, target_date, type, cover_image,
        color, is_active, created_at, updated_at) VALUES (?, 'Expired countdown', '', ?, 'event', NULL, '#E91E63', 1, ?, ?)`)
        .bind(expiredCountdownId, past, createdAt, createdAt),
      db.prepare(`INSERT INTO countdown_events (source_id, title, description, target_date, type, cover_image,
        color, is_active, created_at, updated_at) VALUES (?, 'Inactive countdown', '', ?, 'event', NULL, '#E91E63', 0, ?, ?)`)
        .bind(inactiveCountdownId, future, createdAt, createdAt)
    ];
    await db.batch(setup);

    for (const [path, options] of [
      ["/api/social/mood", {}],
      ["/api/social/mood", { body: {} }],
      ["/api/social/waves", {}],
      ["/api/social/daily-question", {}],
      ["/api/social/voice-polls", {}],
      ["/api/social/countdowns", {}]
    ]) {
      assert.equal((await request(path, 401, options)).error.code, "UNAUTHORIZED");
    }
    assert.equal((await request("/api/social/mood", 422, {
      accessToken: owner.accessToken, body: {}
    })).error.code, "VALIDATION");
    assert.equal((await request("/api/social/activity", 400, {
      accessToken: owner.accessToken, body: { activity: "Unlisted" }
    })).error.message, "Invalid activity option");
    assert.equal((await request("/api/social/activity", 400, {
      accessToken: owner.accessToken, body: { activity: "Chatting", roomId: "bad" }
    })).error.message, "Invalid roomId");
    assert.equal((await request("/api/social/wave", 400, {
      accessToken: owner.accessToken, body: { receiverId: "bad", type: "wave" }
    })).error.message, "Invalid receiverId");
    assert.equal((await request("/api/social/voice-polls", 422, {
      accessToken: owner.accessToken, body: { question: "x", options: [{ text: "only" }] }
    })).error.code, "VALIDATION");
    assert.equal((await request(`/api/social/voice-polls/${ownedPollId}/vote`, 422, {
      accessToken: owner.accessToken, body: { optionIndex: -1 }
    })).error.code, "VALIDATION");
    assert.equal((await request("/api/social/countdowns", 422, {
      accessToken: owner.accessToken, body: { title: "x", targetDate: "nope" }
    })).error.code, "VALIDATION");

    const initialMood = (await request("/api/social/mood", 200, {
      accessToken: owner.accessToken
    })).data.mood;
    assert.deepEqual(initialMood, {
      _id: moodId, userId: ownerId, mood: "happy", emoji: "😊", activity: "Chatting",
      isActive: true, expiresAt: future, createdAt, updatedAt: createdAt, __v: 0
    });

    const changedMood = (await request("/api/social/mood", 200, {
      accessToken: owner.accessToken, body: { mood: "chill" }
    })).data.mood;
    assert.equal(changedMood._id, moodId);
    assert.equal(changedMood.mood, "chill");
    assert.equal(changedMood.emoji, "😎");
    assert.equal(changedMood.activity, "Chatting");
    assert.equal(changedMood.createdAt, createdAt);
    assert.ok(changedMood.updatedAt >= createdAt);
    assert.equal(Object.hasOwn(changedMood, "activityRoomId"), false);

    const changedActivity = (await request("/api/social/activity", 200, {
      accessToken: owner.accessToken, body: { activity: "Playing games" }
    })).data.mood;
    assert.equal(changedActivity.activity, "Playing games");
    assert.equal(changedActivity.activityRoomId, null);
    assert.equal(changedActivity.mood, "chill");
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM user_moods WHERE user_id = ?")
      .bind(ownerId).first("count"), 1);

    const waves = (await request("/api/social/waves", 200, {
      accessToken: owner.accessToken
    })).data.waves;
    assert.deepEqual(waves.map(wave => wave._id), [unreadWaveId, readWaveId]);
    assert.deepEqual(waves[0], {
      _id: unreadWaveId,
      senderId: {
        _id: visitorId, name: originals[1].name, username: originals[1].username,
        avatarParts: { eyes: 4 }
      },
      receiverId: ownerId, type: "wave", read: false,
      createdAt: unreadCreated, updatedAt: unreadCreated, __v: 0
    });
    const unread = (await request("/api/social/waves?unread=true", 200, {
      accessToken: owner.accessToken
    })).data.waves;
    assert.deepEqual(unread.map(wave => wave._id), [unreadWaveId]);
    assert.equal((await request("/api/social/waves/unread-count", 200, {
      accessToken: owner.accessToken
    })).data.count, 1);

    const sent = (await request("/api/social/wave", 200, {
      accessToken: owner.accessToken, body: { receiverId: visitorId, type: "vibe_ping" }
    })).data.wave;
    sentWaveId = sent._id;
    assert.equal(sent.senderId, ownerId);
    assert.equal(sent.receiverId, visitorId);
    assert.equal(sent.type, "vibe_ping");
    assert.equal(sent.read, false);
    assert.equal(sent.__v, 0);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?
      AND type = 'WAVE' AND title = 'New vibe ping' AND body = 'Someone sent you a vibe ping!'
      AND json_extract(data, '$.senderId') = ? AND json_extract(data, '$.type') = 'vibe_ping'
      AND json_extract(data, '$.waveId') = ?`).bind(visitorId, ownerId, sentWaveId).first("count"), 1);

    const marked = (await request(`/api/social/waves/${unreadWaveId}/read`, 200, {
      accessToken: owner.accessToken, method: "POST"
    })).data.wave;
    assert.equal(marked.read, true);
    assert.equal(marked.senderId, visitorId);
    assert.ok(marked.updatedAt >= unreadCreated);
    assert.equal((await request("/api/social/waves/unread-count", 200, {
      accessToken: owner.accessToken
    })).data.count, 0);

    const question = (await request("/api/social/daily-question", 200, {
      accessToken: owner.accessToken
    })).data.question;
    assert.deepEqual(question, {
      _id: questionId, question: "Fixture question", category: "general",
      date: day, isActive: true, createdAt, updatedAt: createdAt, __v: 0
    });

    const answered = (await request("/api/social/daily-question/answer", 200, {
      accessToken: owner.accessToken,
      body: { questionId, answer: "Fixture answer", isPublic: true }
    })).data.answer;
    assert.equal(answered.userId, ownerId);
    assert.equal(answered.questionId, questionId);
    assert.equal(answered.answer, "Fixture answer");
    assert.equal(answered.isPublic, true);
    assert.equal(answered.__v, 0);
    assert.equal((await request("/api/social/daily-question/answer", 409, {
      accessToken: owner.accessToken, body: { questionId, answer: "Again" }
    })).error.message, "Already answered today");
    const publicAnswers = (await request(`/api/social/daily-question/answers/${questionId}`, 200, {
      accessToken: visitor.accessToken
    })).data.answers;
    assert.equal(publicAnswers.length, 1);
    assert.deepEqual(publicAnswers[0].userId, {
      _id: ownerId, name: originals[0].name, username: originals[0].username,
      avatar: "https://social.fixture/owner.png", avatarType: "UPLOADED", avatarParts: { head: 2 }
    });
    const myAnswer = (await request(`/api/social/daily-question/my-answer/${questionId}`, 200, {
      accessToken: owner.accessToken
    })).data.answer;
    assert.equal(myAnswer._id, answered._id);
    assert.equal(myAnswer.userId, ownerId);

    const active = (await request("/api/social/voice-polls?page=1&limit=20", 200, {
      accessToken: owner.accessToken
    })).data;
    assert.equal(active.page, 1);
    assert.equal(active.limit, 20);
    assert.ok(active.total >= 2);
    const ownPolls = active.polls.filter(poll => [seededPollId, ownedPollId].includes(poll._id));
    assert.deepEqual(ownPolls.map(poll => poll._id), [ownedPollId, seededPollId]);
    const seeded = ownPolls.find(poll => poll._id === seededPollId);
    assert.deepEqual(seeded.userId, {
      _id: visitorId, name: originals[1].name, username: originals[1].username,
      avatarParts: { eyes: 4 }
    });
    assert.deepEqual(seeded.options, [
      { text: "One", audioUrl: "https://social.fixture/one.mp3", votes: 2, _id: optionIds[0] },
      { text: "Two", votes: 0, _id: optionIds[1] }
    ]);
    assert.deepEqual(seeded.voters, [ownerId]);
    assert.equal(seeded.ballots.length, 1);
    assert.equal(seeded.ballots[0].optionIndex, 0);
    assert.deepEqual((await request(`/api/social/voice-polls/${seededPollId}`, 200, {
      accessToken: visitor.accessToken
    })).data.poll, seeded);
    const mine = (await request("/api/social/voice-polls/mine", 200, {
      accessToken: owner.accessToken
    })).data.polls.filter(poll => poll._id === ownedPollId);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].userId, ownerId);

    const createdPoll = (await request("/api/social/voice-polls", 200, {
      accessToken: owner.accessToken,
      body: { question: "New poll", options: [{ text: "A" }, { text: "B" }], expiresInHours: 2 }
    })).data.poll;
    assert.equal(createdPoll.userId, ownerId);
    assert.equal(createdPoll.question, "New poll");
    assert.equal(createdPoll.options.length, 2);
    assert.equal(createdPoll.options[0].votes, 0);
    assert.ok(createdPoll.options[0]._id);
    assert.deepEqual(createdPoll.voters, []);
    assert.deepEqual(createdPoll.ballots, []);
    assert.equal(createdPoll.isActive, true);
    assert.ok(Date.parse(createdPoll.expiresAt) > Date.now());

    const voted = (await request(`/api/social/voice-polls/${ownedPollId}/vote`, 200, {
      accessToken: owner.accessToken, body: { optionIndex: 1 }
    })).data.poll;
    assert.equal(voted.options[1].votes, 1);
    assert.deepEqual(voted.voters, [ownerId]);
    assert.equal(voted.ballots.length, 1);
    assert.equal(voted.ballots[0].optionIndex, 1);
    assert.ok(voted.ballots[0]._id);
    assert.deepEqual(voted.userId, {
      _id: ownerId, name: originals[0].name, username: originals[0].username,
      avatar: "https://social.fixture/owner.png", avatarType: "UPLOADED", avatarParts: { head: 2 }
    });
    assert.equal((await request(`/api/social/voice-polls/${ownedPollId}/vote`, 409, {
      accessToken: owner.accessToken, body: { optionIndex: 1 }
    })).error.message, "Already voted");
    const afterReplay = await db.prepare(`SELECT SUM(votes) AS votes FROM voice_poll_options
      WHERE voice_polls_id = ?`).bind(ownedPollId).first("votes");
    assert.equal(afterReplay, 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM voice_poll_votes WHERE voice_polls_id = ?")
      .bind(ownedPollId).first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM voice_poll_ballots WHERE voice_polls_id = ?")
      .bind(ownedPollId).first("count"), 1);

    assert.equal((await request(`/api/social/voice-polls/${ownedPollId}/close`, 403, {
      accessToken: visitor.accessToken, method: "POST"
    })).error.message, "Only the poll creator can close this poll");
    const closed = (await request(`/api/social/voice-polls/${ownedPollId}/close`, 200, {
      accessToken: owner.accessToken, method: "POST"
    })).data.poll;
    assert.equal(closed.isActive, false);
    assert.equal(closed.options[1].votes, 1);
    assert.equal((await request(`/api/social/voice-polls/${ownedPollId}/close`, 200, {
      accessToken: owner.accessToken, method: "POST"
    })).data.poll.isActive, false);
    const afterClose = (await request("/api/social/voice-polls", 200, {
      accessToken: owner.accessToken
    })).data.polls;
    assert.equal(afterClose.some(poll => poll._id === ownedPollId), false);

    const countdowns = (await request("/api/social/countdowns", 200, {
      accessToken: owner.accessToken
    })).data.events.filter(event => [countdownId, expiredCountdownId, inactiveCountdownId].includes(event._id));
    assert.deepEqual(countdowns, [{
      _id: countdownId, title: "Fixture countdown", description: "desc", targetDate: future,
      type: "festival", color: "#112233", isActive: true, createdAt, updatedAt: createdAt, __v: 0
    }]);
    const newCountdown = (await request("/api/social/countdowns", 200, {
      accessToken: visitor.accessToken,
      body: { title: "New countdown", targetDate: future }
    })).data.event;
    assert.equal(newCountdown.title, "New countdown");
    assert.equal(newCountdown.description, "");
    assert.equal(newCountdown.type, "event");
    assert.equal(newCountdown.color, "#E91E63");
    assert.equal(newCountdown.isActive, true);
    assert.equal(Object.hasOwn(newCountdown, "coverImage"), false);
    assert.equal((await request("/api/social/countdowns", 200, {
      accessToken: owner.accessToken
    })).data.events.some(event => event._id === newCountdown._id), true);

    assert.equal((await request("/api/social/mood", 200, {
      accessToken: owner.accessToken, method: "DELETE"
    })).data.cleared, true);
    assert.equal((await request("/api/social/mood", 200, {
      accessToken: owner.accessToken
    })).data.mood, null);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id IN (${userMarks})`).bind(...users).first("count"), beforeNotifications + 1);
  } finally {
    const cleanup = [
      db.prepare(`DELETE FROM user_moods WHERE user_id IN (${userMarks})`).bind(...users),
      db.prepare(`DELETE FROM wave_nudges WHERE source_id IN (?, ?, ?)`)
        .bind(unreadWaveId, readWaveId, sentWaveId ?? ""),
      db.prepare(`DELETE FROM notifications WHERE created_at >= ? AND type = 'WAVE'
        AND user_id IN (${userMarks}) AND json_extract(data, '$.senderId') IN (${userMarks})`)
        .bind(startedAt, ...users, ...users),
      db.prepare("DELETE FROM user_daily_answers WHERE question_id = ?").bind(questionId),
      db.prepare("DELETE FROM daily_questions WHERE source_id = ?").bind(questionId),
      db.prepare(`DELETE FROM voice_poll_votes WHERE voice_polls_id IN (?, ?)`)
        .bind(seededPollId, ownedPollId),
      db.prepare(`DELETE FROM voice_poll_ballots WHERE voice_polls_id IN (?, ?)`)
        .bind(seededPollId, ownedPollId),
      db.prepare(`DELETE FROM voice_poll_options WHERE voice_polls_id IN (?, ?)`)
        .bind(seededPollId, ownedPollId),
      db.prepare("DELETE FROM voice_polls WHERE source_id IN (?, ?)").bind(seededPollId, ownedPollId),
      db.prepare("DELETE FROM countdown_events WHERE source_id IN (?, ?, ?)")
        .bind(countdownId, expiredCountdownId, inactiveCountdownId)
    ];
    for (const original of originals) {
      cleanup.push(db.prepare(`UPDATE users SET avatar = ?, avatar_type = ?, level = ?, level_title = ?,
        avatar_parts_background = ?, avatar_parts_clothes = ?, avatar_parts_head = ?,
        avatar_parts_mouth = ?, avatar_parts_eyes = ?, avatar_parts_top = ?
        WHERE source_id = ?`).bind(original.avatar, original.avatar_type, original.level, original.level_title,
        original.avatar_parts_background, original.avatar_parts_clothes, original.avatar_parts_head,
        original.avatar_parts_mouth, original.avatar_parts_eyes, original.avatar_parts_top, original.source_id));
    }
    // The route-created poll has generated child rows; remove them by parent.
    const createdPollIds = await db.prepare(`SELECT source_id FROM voice_polls
      WHERE user_id IN (${userMarks}) AND question = 'New poll' AND created_at >= ?`)
      .bind(...users, startedAt).all();
    for (const row of createdPollIds.results) {
      cleanup.unshift(db.prepare("DELETE FROM voice_poll_votes WHERE voice_polls_id = ?").bind(row.source_id));
      cleanup.unshift(db.prepare("DELETE FROM voice_poll_ballots WHERE voice_polls_id = ?").bind(row.source_id));
      cleanup.unshift(db.prepare("DELETE FROM voice_poll_options WHERE voice_polls_id = ?").bind(row.source_id));
      cleanup.push(db.prepare("DELETE FROM voice_polls WHERE source_id = ?").bind(row.source_id));
    }
    const createdCountdownIds = await db.prepare(`SELECT source_id FROM countdown_events
      WHERE title = 'New countdown' AND created_at >= ?`).bind(startedAt).all();
    for (const row of createdCountdownIds.results) {
      cleanup.push(db.prepare("DELETE FROM countdown_events WHERE source_id = ?").bind(row.source_id));
    }
    await db.batch(cleanup);
  }
}
