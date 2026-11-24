import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const newId = () => randomBytes(12).toString("hex");
const giftId = name => createHash("sha256").update(`bond-gift:${name}`).digest("hex").slice(0, 24);

export async function verifyD1Bonds(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const root = "/api/bonds";
  const as = (account, path, status, options = {}) =>
    request(path, status, { accessToken: account.accessToken, ...options });
  const send = (account, path, status, body) => as(account, path, status, { body });
  const patch = (account, path, status, body) => as(account, path, status, { method: "PATCH", body });
  const balance = async account => db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?")
    .bind(account.user.id).first("wallet_balance");
  const statusOf = async id => db.prepare("SELECT status FROM bonds WHERE source_id = ?").bind(id).first("status");

  // The earlier messaging fixture leaves the visitor chat-restricted; Bonds treats
  // chat restrictions and shadow bans as ineligible.
  const friendship = newId();
  await db.batch([
    db.prepare("UPDATE users SET age = 23, bond_invitations = 1, bond_notifications = 1, wallet_balance = 500 WHERE source_id = ?")
      .bind(ownerId),
    db.prepare("UPDATE users SET age = 23, bond_invitations = 1, bond_notifications = 1, wallet_balance = 100, is_blocked = 0, deletion_requested_at = NULL, suspended_until = NULL WHERE source_id = ?")
      .bind(visitorId),
    db.prepare("UPDATE user_safety_statuses SET is_chat_restricted = 0, is_shadow_banned = 0, is_wallet_frozen = 0 WHERE user_id IN (?, ?)")
      .bind(ownerId, visitorId),
    db.prepare(`INSERT INTO friendships (source_id, user_id, friend_id, status, created_at, updated_at)
      SELECT ?, ?, ?, 'ACCEPTED', ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM friendships WHERE status = 'ACCEPTED'
          AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)))`)
      .bind(friendship, ownerId, visitorId, new Date().toISOString(), new Date().toISOString(),
        ownerId, visitorId, visitorId, ownerId)
  ]);

  await request(root + "/me", 401);
  const me = (await as(owner, root + "/me", 200)).data;
  assert.equal(me.capacity, 3);
  assert.equal(me.eligible, true);
  assert.deepEqual(me.active, []);
  assert.deepEqual(me.requests, []);
  const catalog = (await as(owner, root + "/gift-catalog", 200)).data.gifts;
  const bracelet = giftId("Friendship Bracelet");
  const lantern = giftId("Memory Lantern");
  assert.ok(catalog.some(gift => gift.id === bracelet && gift.price === 25 && gift.purpose === "INVITATION"));
  assert.ok(catalog.some(gift => gift.id === lantern && gift.price === 30 && gift.points === 20));
  assert.equal((await as(owner, root + "/eligible-friends", 200)).data.friends.length, 1);

  // Opt-out is respected by the eligibility listing, then restored.
  await as(owner, root + "/invitation-settings", 422, { method: "PUT", body: {} });
  await as(visitor, root + "/invitation-settings", 200, { method: "PUT", body: { enabled: false } });
  assert.equal(await db.prepare("SELECT bond_invitations FROM users WHERE source_id = ?").bind(visitorId).first("bond_invitations"), 0);
  assert.deepEqual((await as(owner, root + "/eligible-friends", 200)).data.friends, []);
  await as(visitor, root + "/invitation-settings", 200, { method: "PUT", body: { enabled: true } });
  assert.equal((await as(owner, root + "/eligible-friends", 200)).data.friends[0].id, visitorId);

  // Paid invitation holds the coins; cancel releases them exactly once.
  const held = await send(owner, root + "/invitations", 201, {
    recipient: visitorId, kind: "BESTIE", slot: 1, giftId: bracelet,
    message: "Be my bond", key: "fixture-invite-paid"
  });
  assert.equal(held.data.status, "PENDING");
  assert.equal(await balance(owner), 475);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM wallet_transactions WHERE user_id = ? AND source = 'BOND_HOLD'")
    .bind(ownerId).first("count"), 1);
  assert.deepEqual((await send(owner, root + "/invitations", 201, {
    recipient: visitorId, kind: "BESTIE", slot: 1, giftId: bracelet,
    message: "Be my bond", key: "fixture-invite-paid"
  })).data, { id: held.data.id, status: "PENDING" });
  await send(owner, root + "/invitations", 409, {
    recipient: visitorId, kind: "BESTIE", slot: 1, key: "fixture-invite-other"
  });
  assert.equal((await as(visitor, root + "/me", 200)).data.requests[0].incoming, true);
  assert.equal((await as(owner, root + "/profile/" + visitorId, 200)).data.canInvite, false);
  await send(visitor, root + "/invitations/" + held.data.id + "/cancel", 403, {});
  await send(owner, root + "/invitations/" + held.data.id + "/cancel", 200, {});
  assert.equal((await db.prepare("SELECT status FROM bond_requests WHERE source_id = ?").bind(held.data.id).first("status")), "CANCELLED");
  assert.equal(await balance(owner), 500);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM wallet_transactions WHERE user_id = ? AND source = 'BOND_RELEASE'")
    .bind(ownerId).first("count"), 1);
  // Release is idempotent when the resolved request is revisited.
  await send(owner, root + "/invitations/" + held.data.id + "/decline", 403, {});
  await db.prepare("UPDATE bond_requests SET resolved_at = ? WHERE source_id = ?")
    .bind(new Date(Date.now() - 7 * 3_600_000).toISOString(), held.data.id).run();

  // Free invitation becomes an active pair.
  const invite = await send(owner, root + "/invitations", 201, {
    recipient: visitorId, kind: "BESTIE", slot: 1, key: "fixture-invite-free"
  });
  const accepted = await send(visitor, root + "/invitations/" + invite.data.id + "/accept", 200, {});
  const bondId = accepted.data.bondId;
  assert.ok(bondId);
  assert.equal(await statusOf(bondId), "ACTIVE");
  assert.equal(await balance(owner), 500);
  assert.equal((await as(visitor, root + "/me", 200)).data.active.length, 1);
  assert.equal((await as(owner, root + "/profile/" + visitorId, 200)).data.canInvite, false);

  const bond = (await as(owner, root + "/" + bondId, 200)).data;
  assert.equal(bond.partner.id, visitorId);
  assert.equal(bond.self.id, ownerId);
  assert.equal(bond.preferences.visibility, "PRIVATE");
  assert.deepEqual(bond.activity, []);
  await patch(owner, root + "/" + bondId + "/preferences", 200, { visibility: "PUBLIC", leaderboard: true });
  await patch(visitor, root + "/" + bondId + "/preferences", 200, { visibility: "PUBLIC", leaderboard: true });

  // Check-in awards the reciprocal bonus only after both sides participate.
  await send(owner, root + "/" + bondId + "/check-in", 200, {});
  assert.equal((await db.prepare("SELECT points FROM bonds WHERE source_id = ?").bind(bondId).first("points")), 0);
  await send(visitor, root + "/" + bondId + "/check-in", 200, {});
  assert.equal((await db.prepare("SELECT points FROM bonds WHERE source_id = ?").bind(bondId).first("points")), 10);
  await send(owner, root + "/" + bondId + "/check-in", 200, {});
  assert.equal((await db.prepare("SELECT points FROM bonds WHERE source_id = ?").bind(bondId).first("points")), 10);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM bond_points WHERE bond_id = ? AND kind = 'ACTIVITY'")
    .bind(bondId).first("count"), 1);

  // Bond gifts debit the sender, credit the recipient net of the platform fee and cap daily points.
  await send(owner, root + "/" + bondId + "/gifts", 200, { giftId: lantern, key: "fixture-gift-one" });
  assert.equal(await balance(owner), 470);
  assert.equal(await balance(visitor), 127);
  assert.equal(await db.prepare("SELECT points FROM bonds WHERE source_id = ?").bind(bondId).first("points"), 30);
  await send(owner, root + "/" + bondId + "/gifts", 200, { giftId: lantern, key: "fixture-gift-one" });
  assert.equal(await balance(owner), 470);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM gift_transactions WHERE sender_id = ?")
    .bind(ownerId).first("count"), 1);
  await send(visitor, root + "/" + bondId + "/gifts", 422, { giftId: "bad", key: "fixture-gift-two" });

  const board = (await as(owner, root + "/leaderboards?category=ACTIVITY&window=WEEK&scope=GLOBAL", 200)).data;
  assert.equal(board.entries.length, 1);
  assert.equal(board.entries[0].rank, 1);
  assert.equal(board.entries[0].score, 10);
  const profile = (await as(visitor, root + "/profile/" + ownerId, 200)).data;
  assert.equal(profile.bonds.length, 1);
  assert.equal(profile.bonds[0].kind, "BESTIE");
  assert.equal(profile.canInvite, false);

  // Type change is a request against the existing pair and must be accepted by the partner.
  const changed = await send(owner, root + "/" + bondId + "/type-change", 201, { kind: "SOULMATE", key: "fixture-type-change" });
  assert.equal(changed.data.status, "PENDING");
  assert.equal((await as(visitor, root + "/me", 200)).data.requests[0].typeChange, true);
  await send(owner, root + "/invitations/" + changed.data.id + "/accept", 403, {});
  await send(visitor, root + "/invitations/" + changed.data.id + "/accept", 200, {});
  assert.equal(await db.prepare("SELECT kind FROM bonds WHERE source_id = ?").bind(bondId).first("kind"), "SOULMATE");

  assert.equal((await send(owner, root + "/" + bondId + "/end", 200, {})).data.ended, true);
  assert.equal(await statusOf(bondId), "ENDED");

  // A new pair after ending proves the block hook terminates the currently active bond.
  const again = await send(owner, root + "/invitations", 201, {
    recipient: visitorId, kind: "BESTIE", slot: 1, key: "fixture-invite-again"
  });
  const second = await send(visitor, root + "/invitations/" + again.data.id + "/accept", 200, {});
  assert.equal(await statusOf(second.data.bondId), "ACTIVE");
  await as(owner, "/api/users/" + visitorId + "/block", 200, { body: {} });
  assert.equal(await statusOf(second.data.bondId), "TERMINATED_BY_BLOCK");
  assert.deepEqual((await as(owner, root + "/eligible-friends", 200)).data.friends, []);
  await db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?").bind(ownerId, visitorId).run();
}
