import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler";
import { D1TargetWriter } from "../migration/d1Target.js";
import { applyMapping } from "../migration/mappings.js";
import { stableStringify } from "../migration/snapshot.js";
import { TransformContext } from "../migration/transform.js";

type Session = {
  token: string;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresIn: number;
};

type SignIn = Session & {
  user: { id: string; email: string; emailVerified: boolean; profileCompleted: boolean; walletBalance: number };
  isNewUser: boolean;
};

type AuthResponse<T> = { ok: boolean; data: T; error?: { code: string; message: string } };

test("auth journey preserves Firebase identity linking and the existing session lifecycle", async (t) => {
  const database = await MongoMemoryServer.create();
  const databaseName = "yugm-auth-journey-characterization";
  const uri = database.getUri(databaseName);
  const project = "yugm-auth-fixture";
  const googleAudience = "yugm-google-client-fixture";
  process.env.NODE_ENV = "test";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = databaseName;
  process.env.STORAGE_DRIVER = "mongodb";
  process.env.REDIS_URL = "";
  process.env.JWT_SECRET = "local-auth-journey-test-secret";
  process.env.FCM_PROJECT_ID = project;
  process.env.FCM_CLIENT_EMAIL = "";
  process.env.FCM_PRIVATE_KEY = "";
  process.env.GOOGLE_OAUTH_CLIENT_ID = googleAudience;

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const keyId = "fixture-auth-key";
  const keysUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
  const googleKeysUrl = "https://www.googleapis.com/oauth2/v1/certs";
  const realFetch = globalThis.fetch;
  const certFetch = t.mock.method(globalThis, "fetch", async (...args: Parameters<typeof fetch>) => {
    const input = args[0];
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.href === keysUrl || url.href === googleKeysUrl) {
      return Response.json({ [keyId]: publicKey.export({ type: "spki", format: "pem" }) });
    }
    assert.equal(url.hostname, "127.0.0.1", "only the loopback API and stubbed keys are allowed");
    return realFetch(...args);
  });
  function firebaseToken(uid: string, {
    email, verified, phone, provider = "password", audience = project
  }: { email?: string; verified?: boolean; phone?: string; provider?: string; audience?: string }) {
    return jwt.sign({
      name: "Fixture Name",
      email,
      email_verified: verified,
      phone_number: phone,
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_provider: provider }
    }, privateKey, {
      algorithm: "RS256", keyid: keyId, issuer: `https://securetoken.google.com/${project}`,
      audience, subject: uid, expiresIn: "5m"
    });
  }
  const hash = (refreshToken: string) => createHash("sha256").update(refreshToken).digest("hex");

  try {
    const [{ createApp }, { User }, { AuthSession }, { DeviceToken }] = await Promise.all([
      import("../app.js"),
      import("../models/User.js"),
      import("../models/AuthSession.js"),
      import("../models/DeviceToken.js")
    ]);
    await mongoose.connect(uri);
    const legacy = await User.create({
      name: "Legacy Name", username: "auth_legacy_fixture", email: "legacy@example.test", walletBalance: 17
    });
    const loginToken = firebaseToken("fixture-legacy-uid", { email: "Legacy@example.test", verified: true });
    const server = createApp().listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;
      const base = `http://127.0.0.1:${port}/api/auth`;
      async function request<T>(path: string, expectedStatus: number, data?: object, accessToken?: string, fixtureIp?: string) {
        const response = await fetch(base + path, {
          method: data === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...(fixtureIp && { "CF-Connecting-IP": fixtureIp })
          },
          ...(data !== undefined && { body: JSON.stringify(data) })
        });
        assert.equal(response.status, expectedStatus);
        return await response.json() as AuthResponse<T>;
      }
      const exchange = (idToken: string, status = 200) =>
        request<SignIn>("/google", status, { idToken, acceptTerms: true, provider: "email" });

      await t.test("unverified email and wrong Firebase audience cannot create users or sessions", async () => {
        const unverified = await exchange(firebaseToken("fixture-unverified", { email: "unverified@example.test", verified: false }), 403);
        assert.equal(unverified.error?.code, "FORBIDDEN");
        const wrongAudience = await exchange(firebaseToken("fixture-wrong-project", {
          email: "wrong@example.test", verified: true, audience: "other-fixture"
        }), 401);
        assert.equal(wrongAudience.ok, false);
        assert.equal(await User.countDocuments(), 1);
        assert.equal(await AuthSession.countDocuments(), 0);
      });

      await t.test("verified email links the existing account and later sign-in invalidates its old session", async () => {
        const first = (await exchange(loginToken)).data;
        assert.equal(first.user.id, legacy.id);
        assert.equal(first.user.email, "legacy@example.test");
        assert.equal(first.user.emailVerified, true);
        assert.equal(first.user.walletBalance, 17);
        assert.equal(first.user.profileCompleted, false);
        assert.equal(first.isNewUser, true);
        assert.equal(first.token, first.accessToken);
        assert.ok(first.expiresIn > 0);
        const storedUser = await User.findById(legacy.id).lean();
        assert.equal(storedUser?.firebaseUid, "fixture-legacy-uid");
        assert.ok(storedUser?.termsAcceptedAt);
        assert.equal((await AuthSession.findById(first.sessionId).lean())?.refreshHash, hash(first.refreshToken));

        const conflict = await exchange(firebaseToken("fixture-other-uid", { email: "legacy@example.test", verified: true }), 409);
        assert.equal(conflict.error?.code, "CONFLICT");
        const second = (await exchange(loginToken)).data;
        assert.equal(second.user.id, legacy.id);
        assert.notEqual(first.sessionId, second.sessionId);
        assert.equal(await User.countDocuments(), 1);
        assert.ok((await AuthSession.findById(first.sessionId).lean())?.revokedAt);
        assert.equal((await request("/me", 401, undefined, first.accessToken)).error?.code, "UNAUTHORIZED");
        const self = await request<{ user: SignIn["user"] }>("/me", 200, undefined, second.accessToken);
        assert.equal(self.data.user.id, legacy.id);
        assert.equal(self.data.user.email, "legacy@example.test");
      });

      await t.test("refresh rotates the token within its family and reuse revokes the replacement", async () => {
        const session = (await exchange(loginToken)).data;
        const rotated = (await request<Session>("/refresh", 200, { refreshToken: session.refreshToken })).data;
        assert.notEqual(rotated.sessionId, session.sessionId);
        assert.notEqual(rotated.refreshToken, session.refreshToken);
        const [old, next] = await Promise.all([
          AuthSession.findById(session.sessionId).lean(), AuthSession.findById(rotated.sessionId).lean()
        ]);
        assert.ok(old?.revokedAt);
        assert.equal(old.replacedByHash, hash(rotated.refreshToken));
        assert.equal(next?.familyId, old.familyId);
        assert.equal(next?.userId.toString(), legacy.id);
        const replay = await request("/refresh", 401, { refreshToken: session.refreshToken });
        assert.equal(replay.error?.message, "Refresh token reuse detected");
        assert.ok((await AuthSession.findById(rotated.sessionId).lean())?.revokedAt);
        assert.equal((await request("/me", 401, undefined, rotated.accessToken)).error?.code, "UNAUTHORIZED");
      });

      await t.test("logout revokes persisted sessions and removes only the caller's registered device", async (logoutTest) => {
        const other = await User.create({ name: "Other", username: "auth_other_fixture" });
        const own = await DeviceToken.create({ userId: legacy.id, token: "fixture-owner-device-token", platform: "android" });
        const different = await DeviceToken.create({ userId: other.id, token: "fixture-other-device-token", platform: "android" });
        const initial = (await exchange(loginToken)).data;
        await request("/logout", 200, { deviceToken: different.token }, initial.accessToken);
        assert.ok(await DeviceToken.exists({ _id: different.id }));
        assert.ok(await DeviceToken.exists({ _id: own.id }));
        assert.ok((await AuthSession.findById(initial.sessionId).lean())?.revokedAt);

        const session = (await exchange(loginToken)).data;
        await request("/me", 200, undefined, session.accessToken);
        const { data } = await request<{ loggedOut: boolean }>("/logout", 200, {
          refreshToken: session.refreshToken, deviceToken: own.token
        }, session.accessToken);
        assert.equal(data.loggedOut, true);
        assert.equal(await DeviceToken.exists({ _id: own.id }), null);
        assert.ok(await DeviceToken.exists({ _id: different.id }));
        assert.equal(await AuthSession.countDocuments({ userId: legacy.id, revokedAt: null }), 0);
        assert.equal((await request("/refresh", 401, { refreshToken: session.refreshToken })).error?.code, "UNAUTHORIZED");

        // An already-loaded HTTP auth context can outlive persisted revocation.
        await request("/me", 200, undefined, session.accessToken);
        const afterCacheExpiry = Date.now() + 21_000;
        logoutTest.mock.method(Date, "now", () => afterCacheExpiry);
        assert.equal((await request("/me", 401, undefined, session.accessToken)).error?.message, "Session revoked");
      });

      await t.test("verified new signup returns the existing profile-setup signal and starter balance", async () => {
        const { data } = await exchange(firebaseToken("fixture-new-uid", { email: "new@example.test", verified: true }));
        assert.equal(data.isNewUser, true);
        assert.equal(data.user.profileCompleted, false);
        assert.equal(data.user.walletBalance, 250);
        const created = await User.findById(data.user.id).select("+email").lean();
        assert.equal(created?.firebaseUid, "fixture-new-uid");
        assert.equal(created?.email, "new@example.test");
        assert.ok(created?.termsAcceptedAt);
        assert.ok(await AuthSession.exists({ _id: data.sessionId, userId: data.user.id, revokedAt: null }));
      });
      // Separate fixture IPs model separate clients and retain the real rate limiter.
      await t.test("Google sign-in exchanges the same Firebase token shape as Android", async () => {
        const uid = "fixture-google-uid";
        const email = "google@example.test";
        const token = firebaseToken(uid, { email, verified: true, provider: "google.com" });
        const { data } = await request<SignIn>("/google", 200, {
          idToken: token, acceptTerms: true, provider: "google", mode: "login"
        }, undefined, "192.0.2.10");
        assert.equal(data.user.email, email);
        assert.equal(data.user.profileCompleted, false);
        assert.equal((await User.findById(data.user.id).lean())?.firebaseUid, uid);
      });

      await t.test("legacy direct Google only accepts unexpired tokens issued for the configured client", async () => {
        const uid = "fixture-direct-google-uid";
        const token = (audience: string, expiresIn?: number) => jwt.sign(
          { email: "direct-google@example.test", email_verified: true },
          privateKey, {
            algorithm: "RS256", keyid: keyId, issuer: "https://accounts.google.com", audience,
            subject: uid, ...(expiresIn === undefined ? {} : { expiresIn })
          }
        );
        const exchangeGoogle = (idToken: string, status: number) => request<SignIn>("/google", status, {
          idToken, acceptTerms: true, provider: "google"
        }, undefined, "192.0.2.13");

        for (const idToken of [
          token("other-client-fixture", 300), token(googleAudience, -300), token(googleAudience)
        ]) {
          const rejected = await exchangeGoogle(idToken, 401);
          assert.equal(rejected.ok, false);
        }
        assert.equal(await User.exists({ firebaseUid: uid }), null);

        const { data } = await exchangeGoogle(token(googleAudience, 300), 200);
        assert.equal((await User.findById(data.user.id).lean())?.firebaseUid, uid);
      });

      await t.test("Facebook rejects the wrong Firebase provider and accepts Facebook identity", async () => {
        const uid = "fixture-facebook-uid";
        const email = "facebook@example.test";
        const exchangeFacebook = (provider: string, status: number) => request<SignIn>("/facebook", status, {
          idToken: firebaseToken(uid, { email, verified: true, provider }), acceptTerms: true
        }, undefined, "192.0.2.11");
        const wrongProvider = await exchangeFacebook("google.com", 401);
        assert.equal(wrongProvider.error?.code, "UNAUTHORIZED");
        assert.equal(await User.exists({ firebaseUid: uid }), null);
        const { data } = await exchangeFacebook("facebook.com", 200);
        assert.equal(data.user.email, email);
        assert.equal((await User.findById(data.user.id).lean())?.firebaseUid, uid);
        assert.ok(await AuthSession.exists({ _id: data.sessionId, userId: data.user.id, revokedAt: null }));
      });

      await t.test("phone sign-in keeps the legacy account and its completed-profile flag", async () => {
        const uid = "fixture-phone-uid";
        const phone = "+12025550121";
        const existing = await User.create({
          name: "Legacy Phone", username: "auth_phone_fixture", walletBalance: 31,
          phone: "12025550121", profileCompletedAt: new Date()
        });
        const exchangePhone = (idToken: string, status: number) => request<SignIn>("/phone", status, {
          idToken, acceptTerms: true
        }, undefined, "192.0.2.12");
        assert.equal((await exchangePhone(firebaseToken(uid, { provider: "phone" }), 401)).error?.code, "UNAUTHORIZED");
        assert.equal((await exchangePhone(firebaseToken(uid, { phone, provider: "google.com" }), 401)).error?.code, "UNAUTHORIZED");
        assert.equal(await User.exists({ firebaseUid: uid }), null);

        const { data } = await exchangePhone(firebaseToken(uid, { phone, provider: "phone" }), 200);
        assert.equal(data.isNewUser, false);
        assert.equal(data.user.id, existing.id);
        assert.equal(data.user.walletBalance, 31);
        assert.equal(data.user.profileCompleted, true);
        assert.equal((await User.findById(existing.id).lean())?.firebaseUid, uid);
        const self = await request<{ user: SignIn["user"] }>("/me", 200, undefined, data.accessToken);
        assert.equal(self.data.user.id, existing.id);
        assert.equal(self.data.user.profileCompleted, true);
      });

      await t.test("the candidate D1 Auth journey preserves the full Mongo HTTP contract", async (parity) => {
        const [{ createD1AuthRouter }, { requireAppCheck }, rateLimiters] = await Promise.all([
          import("../migration/d1AuthRouter.js"), import("../middleware/appCheck.js"), import("../middleware/rateLimit.js")
        ]);
        const directory = await mkdtemp(join(tmpdir(), "yugm-auth-journey-d1-"));
        const configPath = join(directory, "wrangler.jsonc");
        await writeFile(configPath, JSON.stringify({
          name: "yugm-auth-journey-fixture",
          compatibility_date: "2026-08-04",
          d1_databases: [{ binding: "DB", database_name: "auth-journey-fixture", database_id: "00000000-0000-4000-8000-000000000004" }]
        }));
        parity.after(async () => {
          await unlink(configPath);
          await rmdir(directory);
        });
        const platform = await getPlatformProxy<{ DB: D1Database }>({
          configPath, envFiles: [], remoteBindings: false, persist: false
        });
        parity.after(() => platform.dispose());
        const db = platform.env.DB;
        const ddl = await readFile(new URL("../../migrations/d1/0001_initial.sql", import.meta.url), "utf8");
        await db.batch(unstable_splitSqlQuery(ddl).map((sql) => db.prepare(sql)));
        const writer = new D1TargetWriter(db);
        const context = new TransformContext("auth-journey-fixture");
        async function importRow(collection: string, row: unknown) {
          const mapped = applyMapping(collection, JSON.parse(stableStringify(row)), context);
          assert.equal(mapped.rejected, false);
          await writer.writeBatch(mapped.writes);
        }

        const profile = await User.create({
          name: "Restored Profile", username: "restored_auth", email: "restored@example.test", role: "HOST",
          walletBalance: 314, xp: 310, avatarType: "GENERATED", avatar: null,
          avatarParts: { background: 0, clothes: 4, head: null }, activeCosmetics: { speakingWave: "wave", profileTheme: null },
          age: 26, gender: "Female", bio: "A restored profile", city: "Pune", state: null,
          interests: ["Travel", "Art"], languages: ["Marathi", "English"], hobbies: ["Running", "Hiking"],
          ownedCosmeticIds: ["cosmetic-z", "cosmetic-a"], lookingFor: "Friendship", datingAgeMax: 35,
          vipFrozen: true, vipExp: -5, vipTier: "VIP2", vipFreezeStartedAt: new Date(),
          vipStartedAt: null, lastDailyCheckInAt: new Date(), followersCount: 17, followingCount: 12
        });
        const unrelated = await User.create({ name: "Other", username: "unrelated_auth", phone: "12025550166" });
        const collision = await User.create({ name: "Unlinked", username: "unlinked_auth", email: "link-race@example.test" });
        const pendingDeletion = await User.create({
          name: "Former Account", username: "pending_deletion_auth", email: "released@example.test",
          firebaseUid: "former-account-uid", walletBalance: 48, deletionRequestedAt: new Date()
        });
        const ownDevice = await DeviceToken.create({ userId: profile.id, token: "registered-auth-journey-device", platform: "android" });
        const otherDevice = await DeviceToken.create({ userId: unrelated.id, token: "unrelated-auth-journey-device", platform: "android" });
        for (const user of [profile, unrelated, collision, pendingDeletion]) {
          await importRow("users", await User.findById(user.id).select("+email +phone").lean());
        }
        await importRow("device_tokens", ownDevice.toObject());
        await importRow("device_tokens", otherDevice.toObject());
        context.assertAccountedFor();
        assert.deepEqual(context.quarantine, []);

        const candidate = express();
        candidate.use(express.json());
        candidate.use("/api/auth", requireAppCheck, createD1AuthRouter(db, rateLimiters));
        const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
          res.status(error.status ?? 500).json({ ok: false, error: { code: error.code, message: error.message } });
        };
        candidate.use(handleError);
        const candidateServer = candidate.listen(0, "127.0.0.1");
        parity.after(async () => {
          const closed = once(candidateServer, "close");
          candidateServer.close();
          await closed;
        });
        await once(candidateServer, "listening");
        const candidateBase = `http://127.0.0.1:${(candidateServer.address() as AddressInfo).port}/api/auth`;
        async function call<T>(origin: string, path: string, status: number, body?: object, bearer?: string, ip?: string) {
          const response = await fetch(origin + path, {
            method: body === undefined ? "GET" : "POST",
            headers: {
              "Content-Type": "application/json", "CF-Connecting-IP": ip ?? (origin === base ? "192.0.2.70" : "192.0.2.71"),
              ...(bearer && { Authorization: `Bearer ${bearer}` })
            },
            ...(body !== undefined && { body: JSON.stringify(body) }),
            signal: AbortSignal.timeout(3_000)
          });
          const data = await response.json() as AuthResponse<T>;
          assert.equal(response.status, status, JSON.stringify(data.error));
          return data;
        }
        const verified = firebaseToken("restored-auth-uid", { email: "Restored@example.test", verified: true, provider: "google.com" });
        const payload = { idToken: verified, acceptTerms: true, provider: "google" };
        const unverified = firebaseToken("restored-email-pending", { email: "pending@example.test", verified: false });
        assert.equal((await call(candidateBase, "/google", 403, { idToken: unverified, acceptTerms: true })).error?.code, "FORBIDDEN");
        const mongo = (await call<SignIn>(base, "/google", 200, payload)).data;
        const local = (await call<SignIn>(candidateBase, "/google", 200, payload)).data;
        assert.equal(local.user.id, profile.id);
        assert.equal(local.isNewUser, false);
        assert.equal(local.isNewUser, mongo.isNewUser);
        assert.deepEqual(local.user, mongo.user);
        const mongoSelf = (await call<{ user: Record<string, unknown> }>(base, "/me", 200, undefined, mongo.accessToken)).data;
        const d1Self = (await call<{ user: Record<string, unknown> }>(candidateBase, "/me", 200, undefined, local.accessToken)).data;
        assert.deepEqual(d1Self, mongoSelf);
        assert.equal(d1Self.user.avatar, null);
        assert.equal(d1Self.user.state, null);
        assert.equal(Object.hasOwn(d1Self.user, "vibeLine"), false);
        assert.deepEqual(d1Self.user.ownedCosmeticIds, ["cosmetic-z", "cosmetic-a"]);
        assert.equal(Object.hasOwn(d1Self.user, "firebaseUid"), false);
        assert.equal(Object.hasOwn(d1Self.user, "phone"), false);
        const linked = await db.prepare("SELECT firebase_uid, wallet_balance, vip_exp FROM users WHERE source_id = ?")
          .bind(profile.id).first();
        assert.deepEqual(linked, { firebase_uid: "restored-auth-uid", wallet_balance: 314, vip_exp: -5 });

        const deny = {
          idToken: firebaseToken("wrong-auth-uid", { email: "restored@example.test", verified: true }), acceptTerms: true
        };
        const mongoConflict = await call(base, "/google", 409, deny);
        const d1Conflict = await call(candidateBase, "/google", 409, deny);
        assert.equal(d1Conflict.error?.code, mongoConflict.error?.code);
        assert.equal(d1Conflict.error?.message, mongoConflict.error?.message);
        assert.equal((await call<SignIn>(candidateBase, "/google", 200, payload)).data.user.id, profile.id);

        const phoneToken = firebaseToken("restored-phone-uid", { phone: "+12025550166", provider: "phone" });
        const phoneBody = { idToken: phoneToken, acceptTerms: true };
        const phoneMongo = (await call<SignIn>(base, "/phone", 200, phoneBody)).data;
        const phoneD1 = (await call<SignIn>(candidateBase, "/phone", 200, phoneBody)).data;
        assert.deepEqual(phoneD1.user, phoneMongo.user);
        assert.equal(phoneD1.user.id, unrelated.id);
        assert.equal(phoneD1.user.profileCompleted, false);

        const facebookToken = firebaseToken("new-facebook-uid", {
          email: "new-facebook@example.test", verified: false, provider: "facebook.com"
        });
        const mongoSignup = (await call<SignIn>(base, "/facebook", 200, { idToken: facebookToken, acceptTerms: true })).data;
        const d1Signup = (await call<SignIn>(candidateBase, "/facebook", 200, { idToken: facebookToken, acceptTerms: true })).data;
        assert.equal(d1Signup.isNewUser, true);
        assert.equal(d1Signup.user.walletBalance, 250);
        function withoutGeneratedIdentity(user: SignIn["user"]) {
          return Object.fromEntries(Object.entries(user).filter(([key]) => !["id", "_id", "username"].includes(key)));
        }
        assert.deepEqual(withoutGeneratedIdentity(d1Signup.user), withoutGeneratedIdentity(mongoSignup.user));
        const verifiedFacebook = firebaseToken("new-facebook-uid", {
          email: "new-facebook@example.test", verified: true, provider: "facebook.com"
        });
        const verifyBody = { idToken: verifiedFacebook };
        const verifiedMongo = (await call<{ emailVerified: boolean }>(base, "/verify-email", 200, verifyBody, mongoSignup.accessToken)).data;
        const verifiedD1 = (await call<{ emailVerified: boolean }>(candidateBase, "/verify-email", 200, verifyBody, d1Signup.accessToken)).data;
        assert.equal(verifiedD1.emailVerified, true);
        assert.equal(verifiedD1.emailVerified, verifiedMongo.emailVerified);

        const released = firebaseToken("replacement-account-uid", { email: "released@example.test", verified: true });
        for (const origin of [base, candidateBase]) {
          const { data } = await call<SignIn>(origin, "/google", 200, { idToken: released, acceptTerms: true });
          assert.notEqual(data.user.id, pendingDeletion.id);
          assert.equal(data.user.walletBalance, 250);
        }
        const oldMongoAccount = await User.findById(pendingDeletion.id).select("+email").lean();
        assert.equal(oldMongoAccount?.email, undefined);
        assert.equal(oldMongoAccount?.walletBalance, 48);
        const oldD1Account = await db.prepare("SELECT email, firebase_uid, wallet_balance FROM users WHERE source_id = ?")
          .bind(pendingDeletion.id).first();
        assert.deepEqual(oldD1Account, { email: null, firebase_uid: null, wallet_balance: 48 });

        for (const origin of [base, candidateBase]) {
          const { data } = await call<SignIn>(origin, "/google", 200, payload);
          const refreshed = (await call<Session>(origin, "/refresh", 200, { refreshToken: data.refreshToken })).data;
          await call(origin, "/logout", 200, { deviceToken: otherDevice.token }, refreshed.accessToken);
          const own = (await call<SignIn>(origin, "/google", 200, payload)).data;
          await call(origin, "/logout", 200, { refreshToken: own.refreshToken, deviceToken: ownDevice.token }, own.accessToken);
          await call(origin, "/refresh", 401, { refreshToken: own.refreshToken });
        }
        assert.equal(await DeviceToken.exists({ _id: ownDevice.id }), null);
        assert.ok(await DeviceToken.exists({ _id: otherDevice.id }));
        const devices = await db.prepare("SELECT source_id FROM device_tokens").all();
        assert.deepEqual(devices.results, [{ source_id: otherDevice.id }]);

        const racers = await Promise.all(["race-first", "race-second"].map(async (uid) => {
          const response = await fetch(candidateBase + "/google", {
            method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.72" },
            body: JSON.stringify({ idToken: firebaseToken(uid, { email: "link-race@example.test", verified: true }), acceptTerms: true }),
            signal: AbortSignal.timeout(3_000)
          });
          return { uid, status: response.status, body: await response.json() as AuthResponse<SignIn> };
        }));
        assert.deepEqual(racers.map((race) => race.status).sort(), [200, 409]);
        const winner = racers.find((race) => race.status === 200)!;
        assert.equal(winner.body.data.user.id, collision.id);
        assert.equal(await db.prepare("SELECT firebase_uid FROM users WHERE source_id = ?").bind(collision.id).first("firebase_uid"), winner.uid);

        const duplicatePhone = await User.create({ name: "Duplicate Phone", username: "duplicate_phone", phone: "+12025550166" });
        await importRow("users", await User.findById(duplicatePhone.id).select("+phone").lean());
        const ambiguous = firebaseToken("unlinked-phone-uid", { phone: "+12025550166", provider: "phone" });
        const refused = await call(candidateBase, "/phone", 409, { idToken: ambiguous, acceptTerms: true }, undefined, "192.0.2.73");
        assert.equal(refused.error?.message, "Multiple accounts share this phone number. Contact support to recover the account.");
        assert.equal(await db.prepare("SELECT source_id FROM users WHERE firebase_uid = ?").bind("unlinked-phone-uid").first(), null);
      });
      assert.ok(certFetch.mock.calls.some(({ arguments: [input] }) => String(input) === keysUrl));
    } finally {
      const closed = once(server, "close");
      server.close();
      await closed;
    }
  } finally {
    await mongoose.disconnect();
    await database.stop();
  }
});
