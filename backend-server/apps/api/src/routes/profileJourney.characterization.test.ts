import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { xpEvents } from "@yugm/shared";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler";
import { D1TargetWriter } from "../migration/d1Target.js";
import { applyMapping } from "../migration/mappings.js";
import { stableStringify } from "../migration/snapshot.js";
import { TransformContext } from "../migration/transform.js";

type ProfileResponse = {
  ok: boolean;
  data: { user: Record<string, unknown>; xpGrant?: { event: string; xpAwarded: number } };
  error?: { code: string; message: string };
};

test("profile reads and edits through the mounted MongoDB API", async (t) => {
  const databaseName = "yugm-profile-characterization";
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: "127.0.0.1" } });
  const uri = database.getUri(databaseName);
  const secret = "local-profile-journey-fixture-secret";
  process.env.NODE_ENV = "test";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = databaseName;
  process.env.JWT_SECRET = secret;
  process.env.REDIS_URL = "";
  process.env.STORAGE_DRIVER = "mongodb";

  try {
    const [{ createApp }, { User }, { AuthSession }, { Follow }, { Friendship }, { Bond }, { Block },
      { ProfileVisit }, { XpGrant }, { BattlePassXpGrant }, { Season }, { TrustVerification }, socket] = await Promise.all([
      import("../app.js"), import("../models/User.js"), import("../models/AuthSession.js"),
      import("../models/Follow.js"), import("../models/Friendship.js"), import("../models/Bond.js"),
      import("../models/Block.js"), import("../models/ProfileVisit.js"), import("../models/XpGrant.js"),
      import("../models/BattlePassXpGrant.js"), import("../models/Season.js"),
      import("../models/TrustVerification.js"), import("../services/socket.js")
    ]);
    await mongoose.connect(uri);
    const email = "owner@example.test";
    const phone = "+15550100001";
    const [owner, peer, other] = await User.create([
      {
        name: "Profile Owner", username: "profile_owner", email, phone, emailVerified: true,
        walletBalance: 21, followersCount: 70, followingCount: 90, bio: "Original bio",
        avatar: "https://assets.example.test/original.png", avatarType: "UPLOADED",
        activeCosmetics: { avatarFrame: null, speakingWave: "fixture_wave" },
        showcasedBadgeIds: ["fixture_badge"],
        profileMedia: [
          { url: "https://assets.example.test/gallery-1.png", type: "IMAGE", caption: null },
          { url: "https://assets.example.test/gallery-2.mp4", type: "VIDEO" }
        ]
      },
      { name: "Profile Peer", username: "profile_peer", mysteriousVisitors: true, isVerified: true },
      { name: "Other Profile", username: "profile_other" }
    ]);
    await Promise.all([
      Follow.create([
        { followerId: peer.id, followingId: owner.id },
        { followerId: other.id, followingId: owner.id },
        { followerId: owner.id, followingId: peer.id }
      ]),
      Friendship.create([
        { userId: peer.id, friendId: owner.id, status: "ACCEPTED" },
        { userId: owner.id, friendId: other.id, status: "PENDING" }
      ]),
      TrustVerification.create({ userId: peer.id, status: "VERIFIED", level: "ADVANCED" }),
      Bond.create([
        {
          users: [owner.id, peer.id], pairKey: `${owner.id}:${peer.id}`, slots: [1, 1], kind: "FRIEND",
          activatedAt: new Date(), milestoneDays: [1, 7], preferences: { [owner.id]: { visibility: "FRIENDS", reminders: false } }
        },
        { users: [owner.id, other.id], pairKey: `${owner.id}:${other.id}`, slots: [2, 1], kind: "FRIEND", status: "ENDED", activatedAt: new Date() }
      ])
    ]);
    const [ownerToken, peerToken, otherToken] = await Promise.all([owner, peer, other].map(async (user) => {
      const session = await AuthSession.create({
        userId: user.id, familyId: user.id, refreshHash: user.id, tokenVersion: user.tokenVersion,
        expiresAt: new Date(Date.now() + 120_000)
      });
      return jwt.sign({ sub: user.id, sid: session.id, typ: "access", tokenVersion: user.tokenVersion },
        secret, { expiresIn: "2m" });
    }));

    const server = createServer(createApp());
    await socket.initSocket(server);
    const invalidations: Array<{ rooms: string[]; payload: unknown }> = [];
    const adapter = socket.io.of("/").adapter;
    const persistedAtInvalidation: Array<Promise<{ username: string; profileCompletedAt?: Date } | null>> = [];
    t.mock.method(adapter, "broadcast", (...[packet, options]: Parameters<typeof adapter.broadcast>) => {
      const [name, payload] = packet.data ?? [];
      if (name !== "sync:invalidate") return;
      invalidations.push({ rooms: [...options.rooms], payload });
      persistedAtInvalidation.push(User.findById(owner.id).select("username profileCompletedAt").lean().exec());
    });
    server.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;
      async function request(path: string, status: number, token?: string, body?: object) {
        const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
          method: body === undefined ? "GET" : "PATCH",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(body !== undefined && { "Content-Type": "application/json" })
          },
          ...(body !== undefined && { body: JSON.stringify(body) })
        });
        const result = await response.json() as ProfileResponse;
        assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
        return result;
      }

      async function snapshotD1(rehearsal: TestContext) {
      const configPath = fileURLToPath(new URL("../../../cloudflare-worker/auth-local/wrangler.jsonc", import.meta.url));
      const platform = await getPlatformProxy<{ AUTH_DB: D1Database }>({
        configPath, envFiles: [], remoteBindings: false, persist: false
      });
      rehearsal.after(() => platform.dispose());
      const db = platform.env.AUTH_DB;
      const schema = await readFile(new URL("../../migrations/d1/0001_initial.sql", import.meta.url), "utf8");
      await db.batch(unstable_splitSqlQuery(schema).map(sql => db.prepare(sql)));
      const writer = new D1TargetWriter(db);
      const context = new TransformContext("profile-journey-rehearsal");
      const [users, follows, friendships, bonds, grants, seasons, battlePassGrants, sessions, verifications] = await Promise.all([
        User.find().select("+email +phone").lean(), Follow.find().lean(), Friendship.find().lean(), Bond.find().lean(),
        XpGrant.find().lean(), Season.find().lean(), BattlePassXpGrant.find().lean(),
        AuthSession.find().lean(), TrustVerification.find().lean()
      ]);
      const collections = [
        ["users", users], ["follows", follows], ["friendships", friendships], ["bonds", bonds],
        ["xp_grants", grants], ["seasons", seasons], ["battle_pass_xp_grants", battlePassGrants],
        ["auth_sessions", sessions], ["trust_verifications", verifications]
      ] as const;
      for (const [collection, rows] of collections) {
        for (const row of rows) {
          const mapped = applyMapping(collection, JSON.parse(stableStringify(row)), context);
          assert.equal(mapped.rejected, false, collection);
          await writer.writeBatch(mapped.writes);
        }
      }
      context.assertAccountedFor();
      assert.deepEqual(context.quarantine, []);
        return { db, users, writer, context };
      }

      await t.test("self and viewer reads retain visibility and relationship semantics on the mounted routes", async () => {
        const self = (await request("/users/me", 200, ownerToken)).data.user;
        const android = (await request(`/users/${owner.id}`, 200, ownerToken)).data.user;
        assert.deepEqual(android, self);
        assert.equal(self._id, owner.id);
        assert.equal(self.walletBalance, 21);
        assert.equal(self.profileCompleted, false);
        assert.equal(self.followersCount, 2);
        assert.equal(self.followingCount, 1);
        assert.equal(self.friendsCount, 1);
        assert.equal(self.bondsCount, 1);
        assert.equal(self.isFollowing, false);
        assert.equal(self.isBonded, false);

        const viewer = (await request(`/users/${owner.id}`, 200, peerToken)).data.user;
        assert.equal((await request(`/users/public/${owner.id}`, 401)).error?.code, "UNAUTHORIZED");
        const publicAlias = (await request(`/users/public/${owner.id}`, 200, peerToken)).data.user;
        assert.equal(viewer.isFollowing, true);
        assert.equal(viewer.isBonded, true);
        assert.deepEqual(publicAlias, viewer);
        for (const profile of [self, viewer, publicAlias]) {
          assert.equal(Object.hasOwn(profile, "email"), false);
          assert.equal(Object.hasOwn(profile, "phone"), false);
        }
        assert.equal(Object.hasOwn(viewer, "walletBalance"), false);
        assert.equal(await ProfileVisit.countDocuments({ profileId: owner.id }), 0);

        const block = await Block.create({ blockerId: owner.id, blockedUserId: peer.id });
        try {
          assert.equal((await request(`/users/${owner.id}`, 404, peerToken)).error?.code, "NOT_FOUND");
          assert.equal((await request(`/users/public/${owner.id}`, 404, peerToken)).error?.code, "NOT_FOUND");
        } finally {
          await block.deleteOne();
        }
      });

      await t.test("invalid and conflicting edits leave the account and its wallet untouched", async () => {
        assert.equal((await request("/users/me", 401)).error?.code, "UNAUTHORIZED");
        assert.equal((await request("/users/me", 401, undefined, { bio: "Unauthorized" })).error?.code, "UNAUTHORIZED");
        assert.equal((await request("/users/me", 422, ownerToken, { name: "Changed", age: 17 })).error?.code, "VALIDATION");
        assert.equal((await request("/users/me", 422, ownerToken, { acceptTerms: false })).error?.code, "VALIDATION");
        const conflict = await request("/users/me", 409, ownerToken, { username: " PROFILE_PEER ", name: "Changed" });
        assert.equal(conflict.error?.code, "CONFLICT");
        const stored = await User.findById(owner.id).orFail().lean();
        assert.equal(stored.username, "profile_owner");
        assert.equal(stored.name, "Profile Owner");
        assert.equal(stored.bio, "Original bio");
        assert.equal(stored.walletBalance, 21);
        assert.equal(stored.termsAcceptedAt, undefined);
        assert.deepEqual(invalidations, []);
      });

      await t.test("MongoDB and D1 return the same committed Profile setup and one-time XP", async (completionTest) => {
        const { db } = await snapshotD1(completionTest);
        const { updateD1Profile } = await import("../migration/d1ProfileEdits.js");
        const payload = {
          name: "  Updated Owner  ", username: "  UPDATED_OWNER  ", city: "  Pune  ", bio: "  Updated bio  ",
          gender: "Female", age: 28, lookingFor: "Friendship", acceptTerms: true,
          interests: [" Music ", "music", "Art"], languages: [" English ", "HINDI", "english"],
          hobbies: [" Painting ", "painting"], walletBalance: 99_999, email: "spoof@example.test", isVerified: true
        };
        const response = (await request("/users/me", 200, ownerToken, payload)).data;
        const migrated = await updateD1Profile(db, `Bearer ${ownerToken}`, payload);
        assert.deepEqual(JSON.parse(JSON.stringify(migrated)), response);
        const stored = await User.findById(owner.id).select("+email").orFail().lean();
        assert.equal(stored.name, "Updated Owner");
        assert.equal(stored.username, "updated_owner");
        assert.equal(stored.city, "Pune");
        assert.equal(stored.bio, "Updated bio");
        assert.deepEqual(stored.interests, ["Music", "Art"]);
        assert.deepEqual(stored.languages, ["English", "HINDI"]);
        assert.deepEqual(stored.hobbies, ["Painting"]);
        assert.equal(stored.email, email);
        assert.equal(stored.isVerified, false);
        assert.equal(stored.walletBalance, 21);
        assert.ok(stored.termsAcceptedAt);
        assert.ok(stored.profileCompletedAt);
        assert.equal(stored.xp, xpEvents.PROFILE_COMPLETE);
        assert.equal(response.xpGrant?.event, "PROFILE_COMPLETE");
        assert.equal(response.xpGrant?.xpAwarded, xpEvents.PROFILE_COMPLETE);
        const grant = { userId: owner.id, event: "PROFILE_COMPLETE", actionKey: `profile-complete:${owner.id}` };
        const battlePassGrant = { userId: owner.id, actionKey: `PROFILE_COMPLETE:profile-complete:${owner.id}` };
        assert.ok(await XpGrant.exists({ ...grant, status: "COMPLETE" }));
        assert.ok(await BattlePassXpGrant.exists(battlePassGrant));
        assert.deepEqual(invalidations, [{ rooms: [`user:${owner.id}`], payload: { topics: ["PROFILE", "TASKS"] } }]);
        const [committed] = await Promise.all(persistedAtInvalidation);
        assert.equal(committed?.username, stored.username);
        assert.deepEqual(committed?.profileCompletedAt, stored.profileCompletedAt);

        const repeated = (await request("/users/me", 200, ownerToken, payload)).data;
        const repeatedD1 = await updateD1Profile(db, `Bearer ${ownerToken}`, payload);
        assert.deepEqual(JSON.parse(JSON.stringify(repeatedD1)), repeated);
        const d1Avatar = await updateD1Profile(db, `Bearer ${ownerToken}`, {
          avatarType: "GENERATED", avatarParts: { background: 1, clothes: 2, head: 3, mouth: 4, eyes: 5, top: 6 }, interests: []
        });
        assert.equal(d1Avatar.user.avatar, null);
        assert.deepEqual(d1Avatar.user.interests, []);
        assert.equal(d1Avatar.user.profileCompleted, true);
        assert.equal(Object.hasOwn(repeated, "xpGrant"), false);
        assert.equal(await XpGrant.countDocuments(grant), 1);
        assert.equal(await BattlePassXpGrant.countDocuments(battlePassGrant), 1);
        const savedAgain = await User.findById(owner.id).orFail().lean();
        assert.deepEqual(savedAgain.termsAcceptedAt, stored.termsAcceptedAt);
        assert.deepEqual(savedAgain.profileCompletedAt, stored.profileCompletedAt);
        assert.equal(savedAgain.xp, stored.xp);

        assert.deepEqual({
          id: response.user.id, name: response.user.name, username: response.user.username,
          city: response.user.city, interests: response.user.interests, profileCompleted: response.user.profileCompleted,
          xp: response.user.xp, bondsCount: response.user.bondsCount, email: response.user.email,
          emailVerified: response.user.emailVerified, walletBalance: response.user.walletBalance
        }, {
          id: owner.id, name: stored.name, username: stored.username, city: stored.city,
          interests: stored.interests, profileCompleted: true, xp: stored.xp, bondsCount: 1,
          email, emailVerified: true, walletBalance: 21
        });
      });

      await t.test("partial edits preserve omitted fields and reflect avatar and list changes on readback", async (editTest) => {
        const parts = { background: 1, clothes: 2, head: 3, mouth: 4, eyes: 5, top: 6 };
        const updated = (await request("/users/me", 200, ownerToken, {
          bio: "   ", hobbies: [], avatarType: "GENERATED", avatarParts: parts
        })).data.user;
        const read = (await request(`/users/${owner.id}`, 200, ownerToken)).data.user;
        for (const profile of [updated, read]) {
          assert.equal(profile.bio, "Updated bio");
          assert.deepEqual(profile.hobbies, []);
          assert.deepEqual(profile.interests, ["Music", "Art"]);
          assert.deepEqual(profile.languages, ["English", "HINDI"]);
          assert.equal(profile.avatar, null);
          assert.equal(profile.avatarType, "GENERATED");
          assert.deepEqual(profile.avatarParts, parts);
          assert.equal(profile.profileCompleted, true);
        }
        const warmAuth = (await request("/auth/me", 200, ownerToken)).data.user;
        assert.equal(warmAuth.username, "profile_owner");
        const afterCacheExpiry = Date.now() + 21_000;
        editTest.mock.method(Date, "now", () => afterCacheExpiry);
        const auth = (await request("/auth/me", 200, ownerToken)).data.user;
        assert.equal(auth.id, owner.id);
        assert.equal(auth.username, "updated_owner");
        assert.equal(auth.email, email);
        assert.equal(auth.profileCompleted, true);
      });

      await t.test("a failed wallet receipt rolls back D1 completion and a retry matches MongoDB rewards", async (editTest) => {
        await User.updateOne({ _id: other._id }, { $set: { xp: 90 } });
        const { db } = await snapshotD1(editTest);
        const { updateD1Profile } = await import("../migration/d1ProfileEdits.js");
        const edit = {
          username: "profile_other_edited", age: 25, gender: "Male", city: "Pune", bio: "First edit",
          interests: ["Music"], languages: ["English"], lookingFor: "Friendship", acceptTerms: true
        };
        const competingLedgerId = "000000000000000000000007";
        await db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata)
          VALUES (?, ?, 'CREDIT', 'LEVEL_REWARD', 25, 0, 25, ?)`)
          .bind(competingLedgerId, other.id, JSON.stringify({ idempotencyKey: `profile-complete:${other.id}` })).run();
        const before = await db.prepare(`SELECT * FROM users WHERE source_id = ?`).bind(other.id).first();
        await assert.rejects(updateD1Profile(db, `Bearer ${otherToken}`, edit), /UNIQUE constraint failed/);
        assert.deepEqual(await db.prepare("SELECT * FROM users WHERE source_id = ?").bind(other.id).first(), before);
        assert.equal(await db.prepare("SELECT edit_token FROM user_auth_profile WHERE source_id = ?").bind(other.id).first("edit_token"), null);
        for (const table of ["xp_grants", "battle_pass_xp_grants", "notifications"]) {
          assert.equal(await db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id = ?`).bind(other.id).first("total"), 0);
        }

        await db.prepare("DELETE FROM wallet_transactions WHERE source_id = ?").bind(competingLedgerId).run();
        const migrated = await updateD1Profile(db, `Bearer ${otherToken}`, edit);
        const legacy = (await request("/users/me", 200, otherToken, edit)).data;
        assert.deepEqual(JSON.parse(JSON.stringify(migrated)), legacy);
        assert.equal(legacy.xpGrant?.xpAwarded, xpEvents.PROFILE_COMPLETE);
        assert.equal(migrated.user.walletBalance, 25);
        assert.deepEqual(await db.prepare("SELECT amount, balance_before, balance_after FROM wallet_transactions WHERE user_id = ?")
          .bind(other.id).first(), { amount: 25, balance_before: 0, balance_after: 25 });
        assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND title = 'Level up!'")
          .bind(other.id).first("total"), 1);
      });

      await t.test("the edited profile, relationship rows and completion receipts import into local D1", async (rehearsal) => {
        // A valid pre-default record must not gain fields simply by being read on D1.
        await User.collection.updateOne({ _id: other._id }, { $unset: {
          languages: "", interests: "", hobbies: "", profileMedia: "", ownedCosmeticIds: "", activeCosmetics: "", walletBalance: ""
        } });
        const { db, users, writer, context } = await snapshotD1(rehearsal);

        const { createD1AuthAccountStore } = await import("../migration/d1AuthAccounts.js");
        const restored = await createD1AuthAccountStore(db).findById(owner.id);
        assert.ok(restored);
        assert.equal(restored.username, "updated_owner");
        assert.equal(restored.email, email);
        assert.equal(restored.walletBalance, 21);
        assert.equal(restored.xp, xpEvents.PROFILE_COMPLETE);
        assert.equal(restored.avatar, null);
        assert.equal(restored.avatarType, "GENERATED");
        assert.deepEqual(restored.languages, ["English", "HINDI"]);
        assert.deepEqual(restored.interests, ["Music", "Art"]);
        assert.deepEqual(restored.hobbies, []);
        assert.equal(restored.profileCompletedAt?.toString(), users.find(row => row._id.toString() === owner.id)?.profileCompletedAt?.toString());

        const counts = await db.prepare(`SELECT
          (SELECT COUNT(*) FROM follows WHERE following_id = ?1) AS followers,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,
          (SELECT COUNT(*) FROM friendships WHERE status = 'ACCEPTED' AND (user_id = ?1 OR friend_id = ?1)) AS friends,
          (SELECT COUNT(*) FROM bonds JOIN bond_users ON bond_users.bonds_id = bonds.source_id
            WHERE bond_users.value = ?1 AND bonds.status = 'ACTIVE') AS bonds,
          (SELECT COUNT(*) FROM xp_grants WHERE user_id = ?1 AND event = 'PROFILE_COMPLETE' AND status = 'COMPLETE') AS completion_grants,
          (SELECT SUM(xp_gained) FROM battle_pass_xp_grants WHERE user_id = ?1) AS battle_pass_xp
        `).bind(owner.id).first();
        assert.deepEqual(counts, {
          followers: 2, following: 1, friends: 1, bonds: 1, completion_grants: 1, battle_pass_xp: xpEvents.PROFILE_COMPLETE
        });
        const activeBond = await db.prepare("SELECT source_id FROM bonds WHERE status = 'ACTIVE'").first<string>("source_id");
        assert.ok(activeBond);
        const milestones = await db.prepare("SELECT day FROM bond_milestones WHERE bonds_id = ? ORDER BY position").bind(activeBond).all();
        assert.deepEqual(milestones.results, [{ day: 1 }, { day: 7 }]);
        const preferences = await db.prepare("SELECT value_json FROM bond_preferences WHERE bonds_id = ? AND key = ?")
          .bind(activeBond, owner.id).first<string>("value_json");
        assert.ok(preferences);
        assert.equal(JSON.parse(preferences).visibility, "FRIENDS");
        assert.equal(JSON.parse(preferences).reminders, 0);

        const { readD1ProfileRequest } = await import("../migration/d1ProfileReads.js");
        async function readD1(path: string, expectedStatus: number, token?: string) {
          const visits: Promise<unknown>[] = [];
          const result = await readD1ProfileRequest(db, new Request(`http://127.0.0.1/api${path}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }), promise => { visits.push(promise); });
          assert.ok(result, path);
          assert.equal(result.status, expectedStatus, path);
          await Promise.all(visits);
          return await result.json() as ProfileResponse;
        }
        async function compare(path: string, status: number, token?: string) {
          const legacy = await request(path, status, token);
          const candidate = await readD1(path, status, token);
          assert.equal(candidate.ok, legacy.ok);
          if (status === 200) assert.deepEqual(candidate.data, legacy.data, path);
          else {
            assert.equal(candidate.error?.code, legacy.error?.code, path);
            assert.equal(candidate.error?.message, legacy.error?.message, path);
          }
          return candidate;
        }

        await compare("/users/me", 200, ownerToken);
        await compare(`/users/${owner.id.toUpperCase()}`, 200, ownerToken);
        await compare(`/users/${owner.id}`, 200, peerToken);
        await compare(`/users/public/${owner.id}`, 401);
        await compare(`/users/by-username/%40UPDATED_OWNER`, 200, peerToken);
        await compare("/users/me", 401, "invalid-fixture-access-token");
        await compare("/users/not-a-user-id", 400, ownerToken);
        await compare("/users/000000000000000000000000", 404, ownerToken);
        const legacyProfile = (await compare("/users/me", 200, otherToken)).data.user;
        assert.equal(Object.hasOwn(legacyProfile, "languages"), false);
        assert.equal(Object.hasOwn(legacyProfile, "walletBalance"), false);
        assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM profile_visits").first("total"), 0);

        // Upsert preserves the original ID for an already imported visit.
        const existingVisit = await ProfileVisit.create({ profileId: peer.id, visitorId: owner.id, lastVisitedAt: new Date("2026-01-01") });
        const visit = applyMapping("profile_visits", JSON.parse(stableStringify(existingVisit.toObject())), context);
        assert.equal(visit.rejected, false);
        await writer.writeBatch(visit.writes);
        const peerProfile = (await compare(`/users/${peer.id}`, 200, ownerToken)).data.user;
        assert.equal(peerProfile.verificationLevel, "ADVANCED");
        await compare(`/users/${peer.id}`, 200, ownerToken);
        const visitRows = await db.prepare("SELECT source_id, last_visited_at FROM profile_visits").all<{ source_id: string; last_visited_at: string }>();
        assert.equal(visitRows.results.length, 1);
        assert.equal(visitRows.results[0].source_id, existingVisit.id);
        assert.ok(visitRows.results[0].last_visited_at > "2026-01-01");

        const blocked = await Block.create({ blockerId: peer.id, blockedUserId: owner.id });
        const mappedBlock = applyMapping("blocks", JSON.parse(stableStringify(blocked.toObject())), context);
        assert.equal(mappedBlock.rejected, false);
        await writer.writeBatch(mappedBlock.writes);
        await compare(`/users/public/${peer.id}`, 404, ownerToken);
        await compare(`/users/public/${owner.id}`, 404, peerToken);
        await db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ?").bind(new Date().toISOString(), peer.id).run();
        assert.equal((await readD1("/users/me", 401, peerToken)).error?.message, "Session revoked");
        context.assertAccountedFor();
        assert.deepEqual(context.quarantine, []);
      });
      await Promise.all(persistedAtInvalidation);
    } finally {
      await socket.closeSocketInfrastructure();
      await socket.io.close();
    }
  } finally {
    await mongoose.disconnect();
    await database.stop();
  }
});
