import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const newId = () => randomBytes(12).toString("hex");
const placeholders = (values) => values.map(() => "?").join(", ");
const batchIfNeeded = async (db, statements) => {
  if (statements.length > 0) await db.batch(statements);
};

export async function verifyD1PkWritesExtended(db, request, owner, visitor, gamer = owner, worker) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const gamerId = gamer.user.id;
  const userIds = [...new Set([ownerId, visitorId, gamerId])];
  const requestAs = (account, path, status, options = {}) =>
    request(path, status, { accessToken: account.accessToken, ...options });
  const realtimeEvents = async (scope) => {
    assert.ok(worker, "PK fan-out assertions require the Worker instance");
    const namespace = await worker.getDurableObjectNamespace("NATIVE_REALTIME");
    const stub = namespace.get(namespace.idFromName(scope));
    const response = await stub.fetch(`https://native-realtime/history?scope=${encodeURIComponent(scope)}`);
    assert.equal(response.status, 200);
    return (await response.json()).envelopes.map((envelope) => envelope.event);
  };

  const now = new Date();
  const time = now.toISOString();
  const past = new Date(now.getTime() - 120_000).toISOString();
  const future = new Date(now.getTime() + 60_000).toISOString();

  const roomA = newId();
  const roomB = newId();
  const roomC = newId();
  const roomEnded = newId();
  const roomVideo = newId();
  const isolatedLeft = newId();
  const isolatedRight = newId();
  const roomIds = [roomA, roomB, roomC, roomEnded, roomVideo, isolatedLeft, isolatedRight];
  const giftId = newId();
  const wrongGiftId = newId();
  const blockId = newId();
  const safetyId = newId();

  const voteBattleId = newId();
  const giftBattleId = newId();
  const reactionBattleId = newId();
  const roomReactionBattleId = newId();
  const noParticipantBattleId = newId();
  const selectedGiftBattleId = newId();
  const rematchOldBattleId = newId();
  const endBattleId = newId();
  const battleIds = [voteBattleId, giftBattleId, reactionBattleId, roomReactionBattleId,
    noParticipantBattleId, selectedGiftBattleId, rematchOldBattleId, endBattleId];

  const userRows = (await db.prepare(`SELECT source_id, wallet_balance, charm_exp, muted_until
    FROM users WHERE source_id IN (${placeholders(userIds)})`).bind(...userIds).all()).results;
  const existingBlocks = (await db.prepare(`SELECT source_id, blocker_id, blocked_user_id FROM blocks
    WHERE (blocker_id = ?1 AND blocked_user_id = ?2) OR (blocker_id = ?2 AND blocked_user_id = ?1)`)
    .bind(ownerId, gamerId).all()).results;

  const seedRoom = (id, title, host, type = "VOICE", status = "LIVE", count = 1, createdAt = time) =>
    db.prepare(`INSERT INTO rooms
      (source_id, title, description, type, host_id, category, tags, language, status, visibility,
       max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
       mic_locked, vip_only, created_at, updated_at)
      VALUES (?, ?, 'extended PK fixture', ?, ?, 'chill', '[]', 'en', ?, 'PUBLIC', 8, ?, 0, ?, 0, 0, 0, ?, ?)`)
      .bind(id, title, type, host, status, count, id, createdAt, time);

  const seedBattle = (id, leftRoom, rightRoom, leftHost, rightHost, options = {}) => db.prepare(`
    INSERT INTO pk_battles
      (source_id, battle_code, title, mode, format, scope, team_size, status, battle_type,
       duration_seconds, selected_gift_id, in_room_battle, state_version, event_sequence,
       termination_reason, started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id,
       left_score, right_score, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'ROOM', 'CROSS_ROOM', 1, ?, 'VOICE', 180, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, id, options.title ?? "Extended PK fixture", options.mode ?? "VOTE", options.status ?? "ACTIVE",
      options.selectedGiftId ?? null, options.inRoom ?? 0, options.version ?? 1, options.sequence ?? 0,
      leftHost, leftRoom, rightRoom, leftHost, rightHost, options.leftScore ?? 0, options.rightScore ?? 0,
      options.startedAt ?? time, time, time);

  const seedParticipant = (battleId, userId, roomId, side) => db.prepare(`
    INSERT INTO pk_participants
      (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at)
    VALUES (?, ?, ?, ?, ?, 'HOST', 0, ?, ?)`).bind(newId(), battleId, userId, roomId, side, side === "LEFT" ? "A" : "B", time);

  const eventCount = async (battleId, type) => db.prepare(
    "SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = ?"
  ).bind(battleId, type).first("count");

  const battleRow = async (id) => db.prepare(`SELECT status, mode, left_score, right_score, state_version,
    event_sequence, winner_side, termination_reason FROM pk_battles WHERE source_id = ?`).bind(id).first();

  try {
    await batchIfNeeded(db, existingBlocks.map((row) => db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(row.source_id)));
    await db.batch([
      seedRoom(roomA, "Extended left", ownerId, "VOICE", "LIVE", 4, past),
      seedRoom(roomB, "Extended right", visitorId, "VOICE", "LIVE", 1, past),
      seedRoom(roomC, "Extended candidate", gamerId, "VOICE", "LIVE", 3, time),
      seedRoom(roomEnded, "Extended ended", visitorId, "VOICE", "ENDED", 1, past),
      seedRoom(roomVideo, "Extended video", visitorId, "VIDEO", "LIVE", 2, time),
      seedRoom(isolatedLeft, "Extended isolated left", ownerId),
      seedRoom(isolatedRight, "Extended isolated right", visitorId),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?), (?, ?, ?, 'SPEAKER', 1, 0, 1, 0, ?), (?, ?, ?, 'AUDIENCE', 0, 0, 2, 0, ?)`)
        .bind(newId(), roomA, ownerId, time, newId(), roomA, visitorId, time, newId(), roomA, gamerId, time),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?)`).bind(newId(), roomB, visitorId, time),
      ...[[giftId, 5], [wrongGiftId, 5]].map(([id, points]) => db.prepare(`
        INSERT INTO gifts
          (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d, interactive,
           animation_key, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
           limited_edition_active, limited_edition_total, limited_edition_remaining, tradable, upgradeable,
           achievement_gift, pet_gift, vehicle_gift)
        VALUES (?, ?, '🎁', 100, ?, 20, 1, '', 0, '', 1, 'normal', 0, 0, '', 'rare', 0, 0, 0, 0, 0, 0, 0, 0)`)
        .bind(id, `Extended PK gift ${id}`, points)),
      db.prepare("UPDATE users SET wallet_balance = ?, charm_exp = ? WHERE source_id = ?").bind(500, 0, gamerId),
      db.prepare("UPDATE users SET charm_exp = ? WHERE source_id = ?").bind(0, visitorId),
      seedBattle(voteBattleId, roomA, roomB, ownerId, visitorId),
      seedBattle(giftBattleId, roomA, roomB, ownerId, visitorId, { mode: "GIFT" }),
      seedBattle(reactionBattleId, roomA, roomB, ownerId, visitorId),
      seedBattle(roomReactionBattleId, roomA, roomB, ownerId, visitorId, { inRoom: 1 }),
      seedBattle(noParticipantBattleId, isolatedLeft, isolatedRight, ownerId, visitorId),
      seedBattle(selectedGiftBattleId, roomA, roomB, ownerId, visitorId, {
        mode: "GIFT", inRoom: 1, selectedGiftId: giftId
      }),
      seedBattle(rematchOldBattleId, roomA, roomB, ownerId, visitorId, {
        status: "COMPLETED", mode: "GIFT", title: "Old extended PK", leftScore: 4, rightScore: 2
      }),
      seedBattle(endBattleId, roomA, roomB, ownerId, visitorId, { leftScore: 5, rightScore: 3 }),
      ...[voteBattleId, giftBattleId, reactionBattleId, roomReactionBattleId, selectedGiftBattleId, endBattleId]
        .flatMap((battleId) => [seedParticipant(battleId, ownerId, roomA, "LEFT"),
          seedParticipant(battleId, visitorId, roomB, "RIGHT")]),
      seedParticipant(voteBattleId, gamerId, roomA, "LEFT"),
      seedParticipant(giftBattleId, gamerId, roomA, "LEFT"),
      seedParticipant(reactionBattleId, gamerId, roomA, "LEFT"),
      seedParticipant(roomReactionBattleId, gamerId, roomA, "LEFT"),
      seedParticipant(selectedGiftBattleId, gamerId, roomA, "LEFT"),
      seedParticipant(noParticipantBattleId, ownerId, isolatedLeft, "LEFT"),
      seedParticipant(noParticipantBattleId, visitorId, isolatedRight, "RIGHT")
    ]);

    const inviteBody = {
      roomId: roomA, opponentRoomId: roomB, opponentHostId: visitorId,
      battleType: "VOICE", mode: "VOTE", durationSeconds: 60, title: "Ext invite"
    };
    const autoBody = { roomId: roomA, battleType: "VOICE", mode: "VOTE", durationSeconds: 60 };

    for (const path of [
      "/api/pk/invite", "/api/pk/auto-match", "/api/pk/end", "/api/pk/rematch",
      `/api/pk/${voteBattleId}/vote`, `/api/pk/${giftBattleId}/send-gift`,
      `/api/pk/${reactionBattleId}/reactions`
    ]) {
      await request(path, 401, { body: {} });
    }
    await requestAs(owner, "/api/pk/invite", 422, { body: { ...inviteBody, roomId: "bad" } });
    await requestAs(owner, "/api/pk/auto-match", 422, { body: { ...autoBody, durationSeconds: 45 } });
    await requestAs(owner, "/api/pk/end", 422, { body: { battleId: "bad" } });
    await requestAs(owner, "/api/pk/rematch", 422, { body: { battleId: "bad" } });

    const sameRoom = await requestAs(owner, "/api/pk/invite", 400, {
      body: { ...inviteBody, opponentRoomId: roomA, opponentHostId: ownerId }
    });
    assert.equal(sameRoom.error.message, "Cross-room PK requires two different rooms");
    const missingRoom = await requestAs(owner, "/api/pk/invite", 404, {
      body: { ...inviteBody, roomId: newId() }
    });
    assert.equal(missingRoom.error.message, "Room not found");
    const inactiveOpponent = await requestAs(owner, "/api/pk/invite", 404, {
      body: { ...inviteBody, opponentRoomId: roomEnded }
    });
    assert.equal(inactiveOpponent.error.message, "Opponent room is not live");
    const wrongHost = await requestAs(owner, "/api/pk/invite", 400, {
      body: { ...inviteBody, opponentHostId: gamerId }
    });
    assert.equal(wrongHost.error.message, "Opponent host does not own that room");
    const wrongType = await requestAs(owner, "/api/pk/invite", 400, {
      body: { ...inviteBody, opponentRoomId: roomVideo }
    });
    assert.equal(wrongType.error.message, "PK type must match both rooms");

    await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id) VALUES (?, ?, ?)")
      .bind(blockId, ownerId, gamerId).run();
    const blocked = await requestAs(owner, "/api/pk/invite", 403, {
      body: { ...inviteBody, opponentRoomId: roomC, opponentHostId: gamerId }
    });
    assert.equal(blocked.error.message, "Cannot invite this host");

    // Auto-match ranks the same candidates as legacy: it does not pre-filter blocks,
    // so a blocked host still reaches invite validation and returns its 403.
    const blockedAutoMatch = await requestAs(owner, "/api/pk/auto-match", 403, { body: autoBody });
    assert.equal(blockedAutoMatch.error.message, "Cannot invite this host");
    await db.prepare("UPDATE rooms SET status = 'ENDED' WHERE source_id = ?").bind(roomC).run();
    try {
      const noOpponent = await requestAs(owner, "/api/pk/auto-match", 404, { body: autoBody });
      assert.equal(noOpponent.error.message, "No live PK opponent is available right now");
    } finally {
      await db.prepare("UPDATE rooms SET status = 'LIVE' WHERE source_id = ?").bind(roomC).run();
    }
    await db.prepare(`DELETE FROM blocks
      WHERE (blocker_id = ?1 AND blocked_user_id = ?2) OR (blocker_id = ?2 AND blocked_user_id = ?1)`)
      .bind(ownerId, gamerId).run();

    const invited = (await requestAs(owner, "/api/pk/invite", 201, { body: inviteBody })).data;
    assert.equal(invited.battle.status, "INVITED");
    assert.equal(invited.battle.scope, "CROSS_ROOM");
    assert.equal(invited.invite.inviteeUserId, visitorId);
    assert.equal(invited.invite.status, "PENDING");
    battleIds.push(invited.battle.battleId);
    assert.equal(await db.prepare("SELECT active_pk_id FROM rooms WHERE source_id = ?").bind(roomA).first("active_pk_id"), invited.battle.battleId);
    assert.equal(await db.prepare("SELECT active_pk_id FROM rooms WHERE source_id = ?").bind(roomB).first("active_pk_id"), invited.battle.battleId);
    assert.equal(await eventCount(invited.battle.battleId, "PK_CREATED"), 1);
    assert.equal(await eventCount(invited.battle.battleId, "PK_INVITE_SENT"), 1);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND title = 'PK Battle Invite' AND json_extract(data, '$.battleId') = ?`)
      .bind(visitorId, invited.battle.battleId).first("count"), 1);
    const inviteConflict = await requestAs(owner, "/api/pk/invite", 409, { body: inviteBody });
    assert.equal(inviteConflict.error.message, "One of the rooms is already in a PK");

    const cancelInvite = (await requestAs(owner, "/api/pk/end", 200, {
      body: { battleId: invited.battle.battleId, reason: "fixture cancel" }
    })).data;
    assert.equal(cancelInvite.battle.status, "CANCELLED");
    assert.equal(cancelInvite.battle.terminationReason, "fixture cancel");
    assert.equal((await battleRow(invited.battle.battleId)).event_sequence, 0);
    await requestAs(gamer, "/api/pk/end", 403, { body: { battleId: endBattleId } });
    const replayCancel = (await requestAs(owner, "/api/pk/end", 200, {
      body: { battleId: invited.battle.battleId }
    })).data;
    assert.equal(replayCancel.battle.status, "CANCELLED");
    assert.equal(await eventCount(invited.battle.battleId, "PK_CANCELLED"), 1);

    const autoMatched = (await requestAs(owner, "/api/pk/auto-match", 201, { body: autoBody })).data;
    assert.equal(autoMatched.invite.inviteeUserId, gamerId);
    assert.equal(autoMatched.invite.inviteeRoomId, roomC);
    battleIds.push(autoMatched.battle.battleId);
    assert.equal(await db.prepare("SELECT active_pk_id FROM rooms WHERE source_id = ?").bind(roomC).first("active_pk_id"), autoMatched.battle.battleId);
    await requestAs(owner, "/api/pk/end", 200, { body: { battleId: autoMatched.battle.battleId } });

    const notEnded = await requestAs(owner, "/api/pk/rematch", 400, { body: { battleId: voteBattleId } });
    assert.equal(notEnded.error.message, "Can only rematch ended battles");
    const notParticipant = await requestAs(gamer, "/api/pk/rematch", 403, { body: { battleId: rematchOldBattleId } });
    assert.equal(notParticipant.error.message, "Only battle participants can request rematch");
    const rematchBody = { battleId: rematchOldBattleId };
    await db.prepare("UPDATE rooms SET status = 'ENDED' WHERE source_id = ?").bind(roomA).run();
    try {
      const deadRoom = await requestAs(owner, "/api/pk/rematch", 400, { body: rematchBody });
      assert.equal(deadRoom.error.message, "Your room must be live");
    } finally {
      await db.prepare("UPDATE rooms SET status = 'LIVE' WHERE source_id = ?").bind(roomA).run();
    }
    await db.prepare("UPDATE rooms SET host_id = ? WHERE source_id = ?").bind(visitorId, roomA).run();
    try {
      const notHost = await requestAs(owner, "/api/pk/rematch", 403, { body: rematchBody });
      assert.equal(notHost.error.message, "Only room host can request rematch");
    } finally {
      await db.prepare("UPDATE rooms SET host_id = ? WHERE source_id = ?").bind(ownerId, roomA).run();
    }
    const rematched = (await requestAs(owner, "/api/pk/rematch", 201, { body: rematchBody })).data;
    assert.match(rematched.battle.title, /^Rematch: /);
    assert.equal(rematched.invite.inviteeUserId, visitorId);
    battleIds.push(rematched.battle.battleId);
    await requestAs(owner, "/api/pk/end", 200, { body: { battleId: rematched.battle.battleId } });

    const badVoteId = await requestAs(gamer, `/api/pk/not-an-id/vote`, 400, { body: { side: "LEFT" } });
    assert.equal(badVoteId.error.message, "Invalid battleId");
    const closedVote = await requestAs(gamer, `/api/pk/${giftBattleId}/vote`, 409, { body: { side: "LEFT" } });
    assert.equal(closedVote.error.message, "This vote PK is no longer accepting votes");
    const voteNonParticipant = await requestAs(gamer, `/api/pk/${noParticipantBattleId}/vote`, 403, { body: { side: "LEFT" } });
    assert.equal(voteNonParticipant.error.message, "Join a PK room before engaging");
    const voted = (await requestAs(gamer, `/api/pk/${voteBattleId}/vote`, 201, { body: { side: "LEFT" } })).data;
    assert.equal(voted.voted, true);
    assert.equal(voted.battle.myVote, "LEFT");
    assert.equal(voted.battle.left.score, 1);
    assert.equal(voted.battle.stateVersion, 2);
    let row = await battleRow(voteBattleId);
    assert.equal(row.event_sequence, 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_votes WHERE battle_id = ? AND voter_id = ?")
      .bind(voteBattleId, gamerId).first("count"), 1);
    assert.equal(await eventCount(voteBattleId, "VOTE_CAST"), 1);
    const voteEvent = await db.prepare("SELECT sequence, state_version, points FROM pk_events WHERE battle_id = ? AND event_type = 'VOTE_CAST'")
      .bind(voteBattleId).first();
    assert.deepEqual(voteEvent, { sequence: 1, state_version: 2, points: 1 });
    const duplicateVote = await requestAs(gamer, `/api/pk/${voteBattleId}/vote`, 409, { body: { side: "RIGHT" } });
    assert.equal(duplicateVote.error.message, "You already voted in this PK");
    row = await battleRow(voteBattleId);
    assert.equal(row.left_score, 1);
    assert.equal(row.state_version, 2);
    assert.equal(await eventCount(voteBattleId, "VOTE_CAST"), 1);

    const giftPath = `/api/pk/${giftBattleId}/send-gift`;
    const badGiftBattle = await requestAs(gamer, "/api/pk/not-an-id/send-gift", 400, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-bad-battle" }
    });
    assert.equal(badGiftBattle.error.message, "Invalid battleId");
    const inactiveGift = await requestAs(gamer, `/api/pk/${rematchOldBattleId}/send-gift`, 404, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-inactive" }
    });
    assert.equal(inactiveGift.error.message, "Active PK not found");
    const unknownGift = await requestAs(gamer, giftPath, 404, {
      body: { giftId: newId(), side: "RIGHT", idempotencyKey: "pk-gift-unknown" }
    });
    assert.equal(unknownGift.error.message, "Gift not found");
    const votesOnly = await requestAs(gamer, `/api/pk/${voteBattleId}/send-gift`, 400, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-votes-only" }
    });
    assert.equal(votesOnly.error.message, "This PK accepts votes only");
    const wrongSelected = await requestAs(gamer, `/api/pk/${selectedGiftBattleId}/send-gift`, 400, {
      body: { giftId: wrongGiftId, side: "RIGHT", idempotencyKey: "pk-gift-wrong-selected" }
    });
    assert.equal(wrongSelected.error.message, "Only the selected PK gift counts toward this battle");
    const sameSide = await requestAs(gamer, giftPath, 400, {
      body: { giftId, side: "LEFT", idempotencyKey: "pk-gift-same-side" }
    });
    assert.equal(sameSide.error.message, "Support the opposing side with PK gifts");

    await db.prepare("UPDATE users SET wallet_balance = 50 WHERE source_id = ?").bind(gamerId).run();
    const poor = await requestAs(gamer, giftPath, 402, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-poor" }
    });
    assert.equal(poor.error.message, "Insufficient coins");
    row = await battleRow(giftBattleId);
    assert.equal(row.right_score, 0);
    assert.equal(row.state_version, 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM gift_transactions WHERE sender_id = ?").bind(gamerId).first("count"), 0);

    await db.prepare("UPDATE users SET wallet_balance = 500 WHERE source_id = ?").bind(gamerId).run();
    await db.prepare(`INSERT INTO user_safety_statuses
      (source_id, user_id, trust_score, risk_level, warning_count, report_count, suspension_count,
       is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen)
      VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1)`).bind(safetyId, gamerId).run();
    const frozen = await requestAs(gamer, giftPath, 403, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-frozen" }
    });
    assert.equal(frozen.error.message, "Wallet is frozen");
    await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();
    row = await battleRow(giftBattleId);
    assert.equal(row.right_score, 0);

    const sentGift = (await requestAs(gamer, giftPath, 201, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-success", quantity: 1 }
    })).data;
    assert.equal(sentGift.battle.right.score, 5);
    assert.equal(sentGift.giftTransaction.roomId, roomB);
    assert.equal(sentGift.giftTransaction.metadata.pkBattleId, giftBattleId);
    row = await battleRow(giftBattleId);
    assert.equal(row.state_version, 2);
    assert.equal(row.event_sequence, 1);
    // The gift costs its coin price (100); PK points (5) only change battle score.
    assert.equal(await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(gamerId).first("wallet_balance"), 400);
    assert.equal(await db.prepare("SELECT charm_exp FROM users WHERE source_id = ?").bind(visitorId).first("charm_exp"), 100);
    assert.equal(await db.prepare(`SELECT total_points, total_gifts_sent FROM pk_leaderboard_entries
      WHERE battle_id = ? AND user_id = ?`).bind(giftBattleId, gamerId).first("total_points"), 5);
    assert.equal(await eventCount(giftBattleId, "GIFT_SENT"), 1);
    assert.equal(await eventCount(giftBattleId, "LEAD_CHANGED"), 1);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM wallet_transactions
      WHERE user_id = ? AND json_extract(metadata, '$.pkBattleId') = ?`).bind(gamerId, giftBattleId).first("count"), 1);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM room_activities
      WHERE room_id = ? AND json_extract(metadata, '$.pkBattleId') = ?`).bind(roomB, giftBattleId).first("count"), 1);
    for (const scope of [`room:${roomA}`, `room:${roomB}`]) {
      const events = await realtimeEvents(scope);
      assert.ok(events.includes("pk:gift:received"), `${scope} missing pk:gift:received`);
      assert.ok(events.includes("pk:score:update"), `${scope} missing pk:score:update`);
    }
    const replayGift = (await requestAs(gamer, giftPath, 201, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-success", quantity: 1 }
    })).data;
    assert.equal(replayGift.giftTransaction._id, sentGift.giftTransaction._id);
    row = await battleRow(giftBattleId);
    assert.equal(row.right_score, 5);
    assert.equal(row.state_version, 2);
    assert.equal(await eventCount(giftBattleId, "GIFT_SENT"), 1);
    // The process-local combo counter advances once per committed gift request
    // (not per quantity) and is keyed by battle, sender and side. An idempotent
    // replay above did not advance it.
    const comboValues = async () => (await db.prepare(`SELECT json_extract(metadata, '$.combo') AS combo
      FROM pk_events WHERE battle_id = ? AND event_type = 'GIFT_SENT'
      ORDER BY created_at, source_id`).bind(giftBattleId).all()).results.map(event => event.combo);
    assert.deepEqual(await comboValues(), [1]);
    const comboGift = (await requestAs(gamer, giftPath, 201, {
      body: { giftId, side: "RIGHT", idempotencyKey: "pk-gift-combo", quantity: 2 }
    })).data;
    assert.equal(comboGift.battle.right.score, 15);
    assert.deepEqual(await comboValues(), [1, 2]);

    const reactionPath = `/api/pk/${reactionBattleId}/reactions`;
    const badReactionBattle = await requestAs(gamer, "/api/pk/not-an-id/reactions", 400, { body: { side: "RIGHT", type: "heart" } });
    assert.equal(badReactionBattle.error.message, "Invalid battleId");
    const roomReaction = await requestAs(gamer, `/api/pk/${roomReactionBattleId}/reactions`, 400, { body: { side: "RIGHT", type: "heart" } });
    assert.equal(roomReaction.error.message, "Room PK supports its configured gift or one-time votes");
    const ownSide = await requestAs(owner, reactionPath, 400, { body: { side: "LEFT", type: "heart" } });
    assert.equal(ownSide.error.message, "Cannot react for your own side");
    for (let index = 0; index < 5; index += 1) {
      const reaction = (await requestAs(gamer, reactionPath, 201, { body: { side: "RIGHT", type: "fire" } })).data;
      assert.equal(reaction.battle.right.score, (index + 1) * 2);
    }
    const limited = await requestAs(gamer, reactionPath, 429, { body: { side: "RIGHT", type: "fire" } });
    assert.equal(limited.error.message, "Reaction limit reached");
    row = await battleRow(reactionBattleId);
    assert.equal(row.right_score, 10);
    assert.equal(row.state_version, 1);
    assert.equal(row.event_sequence, 0);
    assert.equal(await eventCount(reactionBattleId, "REACTION_SENT"), 5);
    assert.equal(await eventCount(reactionBattleId, "LEAD_CHANGED"), 1);
    assert.equal(await eventCount(reactionBattleId, "GIFT_SENT"), 0);
    for (const scope of [`room:${roomA}`, `room:${roomB}`]) {
      const events = await realtimeEvents(scope);
      assert.ok(events.includes("pk:reaction:received"), `${scope} missing pk:reaction:received`);
      assert.ok(events.includes("pk:score:update"), `${scope} missing pk:score:update`);
      assert.ok(events.includes("pk:lead:changed"), `${scope} missing pk:lead:changed`);
    }

    await db.prepare("UPDATE rooms SET active_pk_id = ? WHERE source_id IN (?, ?)")
      .bind(endBattleId, roomA, roomB).run();
    const ended = (await requestAs(owner, "/api/pk/end", 200, {
      body: { battleId: endBattleId, reason: "fixture end" }
    })).data;
    assert.equal(ended.battle.status, "COMPLETED");
    assert.equal(ended.battle.winnerSide, "LEFT");
    assert.equal(ended.battle.terminationReason, "fixture end");
    row = await battleRow(endBattleId);
    // ACTIVE ends transition through FINALIZING before COMPLETED, bumping stateVersion twice.
    assert.equal(row.state_version, 3);
    assert.equal(row.event_sequence, 0);
    assert.equal(await eventCount(endBattleId, "PK_FINALIZING"), 1);
    assert.equal(await eventCount(endBattleId, "PK_COMPLETED"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE source_id IN (?, ?) AND active_pk_id = ?")
      .bind(roomA, roomB, endBattleId).first("count"), 0);
    const replayEnd = (await requestAs(owner, "/api/pk/end", 200, { body: { battleId: endBattleId } })).data;
    assert.equal(replayEnd.battle.status, "COMPLETED");
    assert.equal(await eventCount(endBattleId, "PK_COMPLETED"), 1);
    assert.equal((await battleRow(endBattleId)).event_sequence, 0);
  } finally {
    await db.prepare(`UPDATE rooms SET active_pk_id = NULL WHERE source_id IN (${placeholders(roomIds)})`).bind(...roomIds).run();
    await db.batch([
      db.prepare(`DELETE FROM notifications WHERE json_extract(data, '$.battleId') IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM pk_events WHERE battle_id IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM pk_votes WHERE battle_id IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM pk_leaderboard_entries WHERE battle_id IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM pk_invites WHERE battle_id IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM pk_participants WHERE battle_id IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM gift_transactions WHERE json_extract(metadata, '$.pkBattleId') IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM wallet_transactions WHERE json_extract(metadata, '$.pkBattleId') IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM room_activities WHERE json_extract(metadata, '$.pkBattleId') IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM pk_battles WHERE source_id IN (${placeholders(battleIds)})`).bind(...battleIds),
      db.prepare(`DELETE FROM room_participants WHERE room_id IN (${placeholders(roomIds)})`).bind(...roomIds),
      db.prepare(`DELETE FROM rooms WHERE source_id IN (${placeholders(roomIds)})`).bind(...roomIds),
      db.prepare("DELETE FROM gifts WHERE source_id IN (?, ?)").bind(giftId, wrongGiftId),
      db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(blockId),
      db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId)
    ]);
    await batchIfNeeded(db, userIds.map((id) => {
      const before = userRows.find((row) => row.source_id === id);
      assert.ok(before, `Missing user snapshot for ${id}`);
      return db.prepare("UPDATE users SET wallet_balance = ?, charm_exp = ?, muted_until = ? WHERE source_id = ?")
        .bind(before.wallet_balance, before.charm_exp, before.muted_until, id);
    }));
    await batchIfNeeded(db, existingBlocks.map((row) => db.prepare(`INSERT INTO blocks
      (source_id, blocker_id, blocked_user_id) VALUES (?, ?, ?)`)
      .bind(row.source_id, row.blocker_id, row.blocked_user_id)));
  }
}
