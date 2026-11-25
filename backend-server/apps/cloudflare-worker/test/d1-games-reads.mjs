import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");
const avatarParts = ["background", "clothes", "head", "mouth", "eyes", "top"];
const avatarColumns = ["avatar", "avatar_type", "level", "level_title", ...avatarParts.map(key => `avatar_parts_${key}`)];

export async function verifyD1GamesReads(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const users = [ownerId, visitorId];
  const scoreIds = [id(), id(), id(), id()];
  const challengeIds = [id(), id(), id(), id()];
  // The route uses Clan.findOne({ memberIds }) without a sort. A minimal ID
  // keeps this fixture's temporary clan first among any fixture clans.
  const clanId = "000000000000000000000001";
  const clanMemberId = "000000000000000000000002";
  const originals = await Promise.all(users.map(userId => db.prepare(
    `SELECT ${avatarColumns.join(", ")}, name, username FROM users WHERE source_id = ?`).bind(userId).first()));
  const beforeNotifications = await db.prepare(`SELECT COUNT(*) AS count FROM notifications
    WHERE user_id IN (?, ?)`).bind(...users).first("count");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const day = today.toISOString();
  const at = (offset) => new Date(today.getTime() + offset).toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const incomingCreated = new Date(Date.parse(future) - 60_000).toISOString();
  const expiredCreated = new Date(Date.parse(past) - 60_000).toISOString();
  const outgoingCreated = new Date(Date.parse(past) - 120_000).toISOString();
  const clanCreated = new Date(Date.parse(future) - 30_000).toISOString();

  const scores = [
    { source_id: scoreIds[0], user_id: ownerId, game_id: "vibe_tap", score: 900, created_at: at(1_000), metadata: '{"streak":2}', catalog_fields: '{"__v":0}' },
    { source_id: scoreIds[1], user_id: ownerId, game_id: "vibe_tap", score: 500, created_at: at(2_000), metadata: "{}", catalog_fields: '{"__v":0}' },
    { source_id: scoreIds[2], user_id: ownerId, game_id: "vibe_tap", score: 100, created_at: at(3_000), metadata: "{}", catalog_fields: '{"__v":0}' },
    { source_id: scoreIds[3], user_id: visitorId, game_id: "vibe_tap", score: 800, created_at: at(4_000), metadata: "{}", catalog_fields: '{"__v":0}' }
  ];
  const challenges = [
    { source_id: challengeIds[0], challenger_id: visitorId, target_user_id: ownerId, clan_id: null, game_id: "vibe_tap", score: 321, message: null, expires_at: future, created_at: incomingCreated },
    { source_id: challengeIds[1], challenger_id: visitorId, target_user_id: ownerId, clan_id: null, game_id: "vibe_tap", score: 999, message: null, expires_at: past, created_at: expiredCreated },
    { source_id: challengeIds[2], challenger_id: ownerId, target_user_id: visitorId, clan_id: null, game_id: "memory_match", score: 456, message: "rematch", expires_at: past, created_at: outgoingCreated },
    { source_id: challengeIds[3], challenger_id: visitorId, target_user_id: null, clan_id: clanId, game_id: "reflex_ring", score: 789, message: null, expires_at: future, created_at: clanCreated }
  ];

  try {
    const setup = [
      db.prepare(`UPDATE users SET avatar = ?, avatar_type = ?, level = ?, level_title = ?,
        avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = ?,
        avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL
        WHERE source_id = ?`).bind("https://games.fixture/owner.png", "UPLOADED", 9, "Champion", 7, ownerId),
      db.prepare(`UPDATE users SET avatar = NULL, avatar_type = NULL, level = ?, level_title = ?,
        avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = ?,
        avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL
        WHERE source_id = ?`).bind(4, "Rookie", 4, visitorId),
      db.prepare(`INSERT INTO clans (source_id, owner_id, name, slug, description, avatar, privacy,
        family_label, member_count, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, 'PUBLIC', ?, 1, ?, ?)`)
        .bind(clanId, ownerId, "Game Clan", "game-clan", "https://games.fixture/clan.png", "Gamers", day, day),
      db.prepare("INSERT INTO clan_members (source_id, value, clans_id, position) VALUES (?, ?, ?, 0)")
        .bind(clanMemberId, ownerId, clanId)
    ];
    for (const row of scores) {
      setup.push(db.prepare(`INSERT INTO mini_game_scores (source_id, user_id, game_id, score,
        duration_ms, rounds, metadata, created_at, updated_at, catalog_fields)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?)`)
        .bind(row.source_id, row.user_id, row.game_id, row.score, row.metadata, row.created_at, row.catalog_fields));
    }
    for (const row of challenges) {
      setup.push(db.prepare(`INSERT INTO mini_game_challenges (source_id, challenger_id, target_user_id,
        clan_id, game_id, score, score_id, message, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)`)
        .bind(row.source_id, row.challenger_id, row.target_user_id, row.clan_id, row.game_id,
          row.score, row.message, row.expires_at, row.created_at));
    }
    await db.batch(setup);

    await request("/api/games/missions", 401);
    await request("/api/games/leaderboard", 401);
    await request("/api/games/challenges", 401);

    assert.deepEqual((await request("/api/games/missions", 200, {
      accessToken: owner.accessToken
    })).data, {
      date: day,
      missions: [
        { id: "play_3", title: "Play 3 arcade rounds", progress: 3, target: 3, rewardXp: 12, complete: true },
        { id: "score_500", title: "Score 500+ in any game", progress: 500, target: 500, rewardXp: 10, complete: true },
        { id: "send_challenge", title: "Challenge a friend or clan", progress: 1, target: 1, rewardXp: 8, complete: true }
      ]
    });

    const leaderboard = (await request("/api/games/leaderboard?gameId=vibe_tap&limit=10", 200, {
      accessToken: owner.accessToken
    })).data;
    assert.equal(leaderboard.gameId, "vibe_tap");
    // Other fixture scores share this global leaderboard; verify this fixture's
    // rows and their relative order instead of assuming an empty table.
    const ownRows = leaderboard.leaderboard.filter(row => users.includes(row.userId));
    assert.deepEqual(ownRows.map(row => row.userId), [ownerId, visitorId]);
    assert.deepEqual(ownRows.map(row => row.score), [900, 800]);
    assert.deepEqual(ownRows[0].user, {
      _id: ownerId,
      name: originals[0].name,
      username: originals[0].username,
      avatar: "https://games.fixture/owner.png",
      avatarType: "UPLOADED",
      avatarParts: { head: 7 },
      level: 9,
      levelTitle: "Champion"
    });
    assert.deepEqual(ownRows[1].user, {
      _id: visitorId,
      name: originals[1].name,
      username: originals[1].username,
      avatarParts: { head: 4 },
      level: 4,
      levelTitle: "Rookie"
    });
    assert.equal(leaderboard.personalBest._id, scoreIds[0]);
    assert.equal(leaderboard.personalBest.userId, ownerId);
    assert.equal(leaderboard.personalBest.score, 900);
    assert.equal(leaderboard.personalBest.__v, 0);
    assert.deepEqual(leaderboard.personalBest.metadata, { streak: 2 });

    const defaulted = (await request("/api/games/leaderboard?gameId=nope", 200, {
      accessToken: owner.accessToken
    })).data;
    assert.equal(defaulted.gameId, "vibe_tap");
    assert.deepEqual(defaulted.leaderboard.filter(row => users.includes(row.userId)).map(row => row.score), [900, 800]);

    const negative = await request("/api/games/leaderboard?gameId=vibe_tap&limit=-1", 500, {
      accessToken: owner.accessToken
    });
    assert.equal(negative.error.code, "INTERNAL");
    assert.match(negative.error.message, /\$limit: -1/);

    await assertChallenges(request, owner, originals, {
      incomingId: challengeIds[0], outgoingId: challengeIds[2], clanChallengeId: challengeIds[3],
      clanId, ownerId, visitorId, future, past, incomingCreated, outgoingCreated, clanCreated
    });

    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications WHERE user_id IN (?, ?)`)
      .bind(...users).first("count"), beforeNotifications);
  } finally {
    const cleanup = [
      db.prepare("DELETE FROM mini_game_challenges WHERE source_id IN (?, ?, ?, ?)").bind(...challengeIds),
      db.prepare("DELETE FROM mini_game_scores WHERE source_id IN (?, ?, ?, ?)").bind(...scoreIds),
      db.prepare("DELETE FROM clan_members WHERE source_id = ?").bind(clanMemberId),
      db.prepare("DELETE FROM clans WHERE source_id = ?").bind(clanId)
    ];
    originals.forEach((row, index) => cleanup.push(db.prepare(`UPDATE users SET
      avatar = ?, avatar_type = ?, level = ?, level_title = ?,
      avatar_parts_background = ?, avatar_parts_clothes = ?, avatar_parts_head = ?,
      avatar_parts_mouth = ?, avatar_parts_eyes = ?, avatar_parts_top = ?
      WHERE source_id = ?`).bind(row.avatar, row.avatar_type, row.level, row.level_title,
      row.avatar_parts_background, row.avatar_parts_clothes, row.avatar_parts_head,
      row.avatar_parts_mouth, row.avatar_parts_eyes, row.avatar_parts_top, users[index])));
    await db.batch(cleanup);
  }
}

async function assertChallenges(request, owner, originals, ids) {
  const challenges = (await request("/api/games/challenges", 200, {
    accessToken: owner.accessToken
  })).data;
  assert.deepEqual(challenges.incoming.map(row => row._id), [ids.incomingId]);
  assert.deepEqual(challenges.incoming[0], {
    _id: ids.incomingId,
    gameId: "vibe_tap",
    score: 321,
    expiresAt: ids.future,
    createdAt: ids.incomingCreated,
    challenger: {
      _id: ids.visitorId,
      name: originals[1].name,
      username: originals[1].username,
      avatarParts: { head: 4 },
      level: 4,
      levelTitle: "Rookie"
    },
    targetUser: ids.ownerId
  });
  assert.deepEqual(challenges.outgoing.map(row => row._id), [ids.outgoingId]);
  assert.deepEqual(challenges.outgoing[0], {
    _id: ids.outgoingId,
    gameId: "memory_match",
    score: 456,
    message: "rematch",
    expiresAt: ids.past,
    createdAt: ids.outgoingCreated,
    challenger: ids.ownerId,
    targetUser: {
      _id: ids.visitorId,
      name: originals[1].name,
      username: originals[1].username,
      avatarParts: { head: 4 },
      level: 4,
      levelTitle: "Rookie"
    }
  });
  assert.deepEqual(challenges.clan.map(row => row._id), [ids.clanChallengeId]);
  assert.deepEqual(challenges.clan[0], {
    _id: ids.clanChallengeId,
    gameId: "reflex_ring",
    score: 789,
    expiresAt: ids.future,
    createdAt: ids.clanCreated,
    challenger: {
      _id: ids.visitorId,
      name: originals[1].name,
      username: originals[1].username,
      avatarParts: { head: 4 },
      level: 4,
      levelTitle: "Rookie"
    },
    clan: {
      _id: ids.clanId,
      name: "Game Clan",
      slug: "game-clan",
      avatar: "https://games.fixture/clan.png",
      familyLabel: "Gamers"
    }
  });
}
