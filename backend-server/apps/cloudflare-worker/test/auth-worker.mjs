import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { convertV4MiniflareOptions, Miniflare, Response } from "miniflare";
import sharp from "sharp";
import { unstable_splitSqlQuery } from "wrangler";
import { verifyD1Admin } from "./d1-admin.mjs";
import { verifyD1AdminSupport } from "./d1-admin-support.mjs";
import { verifyD1BattlePass } from "./d1-battle-pass.mjs";
import { verifyD1Bonds } from "./d1-bonds.mjs";
import { verifyD1Dating } from "./d1-dating.mjs";
import { verifyD1DirectGifts } from "./d1-direct-gifts.mjs";
import { verifyD1AppEndpoints } from "./d1-endpoints.mjs";
import { verifyD1Events } from "./d1-events.mjs";
import { verifyD1Experience } from "./d1-experience.mjs";
import { verifyD1Feed } from "./d1-feed.mjs";
import { verifyD1GamesReads } from "./d1-games-reads.mjs";
import { verifyD1GiftCatalog } from "./d1-gift-catalog.mjs";
import { verifyD1Groups } from "./d1-groups.mjs";
import { verifyD1Highlights } from "./d1-highlights.mjs";
import { verifyD1Missions } from "./d1-missions.mjs";
import { verifyD1Moderation } from "./d1-moderation.mjs";
import { verifyD1Wishlist } from "./d1-wishlist.mjs";
import { verifyD1Maintenance, verifyD1Progression, verifyD1PushDelivery } from "./d1-maintenance.mjs";
import { verifyD1Referrals } from "./d1-referrals.mjs";
import { verifyD1Reports } from "./d1-reports.mjs";
import { verifyD1RoomInvites } from "./d1-room-invites.mjs";
import { verifyD1RoomGifts } from "./d1-room-gifts.mjs";
import { verifyD1RoomMessages } from "./d1-room-messages.mjs";
import { verifyD1RoomModes } from "./d1-room-modes.mjs";
import { verifyD1RoomPkHistory } from "./d1-room-pk-history.mjs";
import { verifyD1RoomPolls } from "./d1-room-polls.mjs";
import { verifyD1RoomReactions } from "./d1-room-reactions.mjs";
import { verifyD1SocialFeatures } from "./d1-social-features.mjs";
import { verifyD1Stories } from "./d1-stories.mjs";
import { verifyD1Subscriptions } from "./d1-subscriptions.mjs";
import { verifyD1Themes } from "./d1-themes.mjs";
import { verifyD1Vibe } from "./d1-vibe.mjs";
import { verifyD1Wallet } from "./d1-wallet.mjs";
import { verifyD1WatchParty } from "./d1-watch-party.mjs";

const run = promisify(execFile);
const pathFromHere = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const project = "yugm-auth-workerd-fixture";
const keyId = "fixture-firebase-key";
const razorpaySecret = "fixture-razorpay-secret";
const adminJwtSecret = "fixture-admin-jwt-secret";
const googlePlayPackage = "com.yugm.fixture";
const keysUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const hash = (token) => createHash("sha256").update(token).digest("hex");

test("isolated Worker serves Auth, Profile, media, cosmetics and clan membership with local D1 and R2", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "yugm-auth-worker-"));
  const configPath = pathFromHere("../auth-local/wrangler.jsonc");
  let worker;
  let legacyWorker;
  try {
    await run(process.execPath, [pathFromHere("../../../node_modules/wrangler/bin/wrangler.js"),
      "deploy", "--dry-run", "--config", configPath, "--outdir", directory, "--metafile"], {
      cwd: pathFromHere("../"), env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, windowsHide: true
    });
    const bundle = JSON.parse(await readFile(join(directory, "bundle-meta.json"), "utf8"));
    assert.deepEqual(Object.keys(bundle.inputs).filter(path =>
      /(?:^|[/\\])(?:sharp[/\\]|imageProcessor\.node\.ts$|mongoose[/\\]|mongodb[/\\]|bson[/\\]|ioredis[/\\]|bullmq[/\\]|redis-adapter[/\\]|redis\.ts$)/.test(path)), []);
    const config = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(config.workers_dev, false);
    assert.equal(config.preview_urls, false);
    const [binding] = config.d1_databases;
    assert.equal(config.d1_databases.length, 1);
    assert.equal(binding.database_name, "yugm");
    assert.equal(binding.database_id, "00000000-0000-4000-8000-000000000004");
    assert.equal(binding.remote, false);
    assert.equal(config.r2_buckets.length, 5);
    assert.deepEqual(config.r2_buckets.map(({ bucket_name: name }) => name),
      ["assets", "public-media", "private-media", "originals", "staging"]);
    assert.ok(config.r2_buckets.every(({ remote }) => remote === false));
    assert.equal(config.images.binding, "IMAGES");
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const signingCert = publicKey.export({ type: "spki", format: "pem" });
    let certificateRequests = 0;
    const pushAttempts = new Map();
    let googleConsumes = 0;
    worker = new Miniflare(convertV4MiniflareOptions({
      modulesRoot: directory,
      modules: [{ type: "ESModule", path: join(directory, "authLocal.js") }],
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      bindings: {
        ...config.vars, FCM_PROJECT_ID: project, JWT_SECRET: randomBytes(32).toString("hex"),
        MONETIZATION_DIAMONDS_ENABLED: "true",
        ADMIN_JWT_SECRET: adminJwtSecret,
        FCM_CLIENT_EMAIL: `fixture@${project}.iam.gserviceaccount.com`,
        FCM_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }), YUGM_FCM_PUSH_ENABLED: "true",
        LIVEKIT_API_KEY: "fixture-livekit-key", LIVEKIT_API_SECRET: "fixture-livekit-secret",
        LIVEKIT_URL: "wss://livekit.fixture",
        RAZORPAY_KEY_ID: "rzp_test_fixture", RAZORPAY_KEY_SECRET: razorpaySecret,
        GOOGLE_PLAY_PACKAGE_NAME: googlePlayPackage, GOOGLE_PLAY_CLIENT_EMAIL: "gplay-fixture@yugm.test",
        GOOGLE_PLAY_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" })
      },
      d1Databases: { [binding.binding]: binding.database_id },
      ratelimits: Object.fromEntries(config.ratelimits.map(({ name, ...settings }) => [name, settings])),
      r2Buckets: Object.fromEntries(config.r2_buckets.map(({ binding: name, bucket_name: bucket }) => [name, bucket])),
      images: { binding: config.images.binding },
      cf: false,
      async outboundService(request) {
        const razorpayAuth = `Basic ${Buffer.from(`rzp_test_fixture:${razorpaySecret}`).toString("base64")}`;
        if (request.url === "https://api.razorpay.com/v1/orders") {
          assert.equal(request.headers.get("Authorization"), razorpayAuth);
          const body = await request.json();
          assert.equal(body.currency, "INR");
          assert.equal(body.amount, 2900);
          return Response.json({ id: "order_fixture", amount: body.amount, currency: "INR", status: "created" });
        }
        if (request.url === "https://api.razorpay.com/v1/payments/pay_fixture") {
          assert.equal(request.headers.get("Authorization"), razorpayAuth);
          return Response.json({ id: "pay_fixture", order_id: "order_fixture", status: "captured", amount: 2900, currency: "INR" });
        }
        const googlePlayBase = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${googlePlayPackage}/purchases/products/`;
        if (request.url.startsWith(googlePlayBase)) {
          assert.equal(request.headers.get("Authorization"), "Bearer fixture-fcm-access");
          if (request.url.endsWith(":consume")) {
            assert.equal(request.method, "POST");
            googleConsumes += 1;
            return Response.json({});
          }
          assert.equal(request.method, "GET");
          return Response.json({ purchaseState: 0, consumptionState: 0, orderId: "GPA.FIXTURE.1" });
        }
        if (request.url === "https://oauth2.googleapis.com/token") {
          return Response.json({ access_token: "fixture-fcm-access", expires_in: 3600, token_type: "Bearer" });
        }
        if (request.url === `https://fcm.googleapis.com/v1/projects/${project}/messages:send`) {
          assert.equal(request.headers.get("Authorization"), "Bearer fixture-fcm-access");
          const { message } = await request.json();
          assert.equal(message.data.partnerId, "fixture");
          assert.ok(message.data.notificationId);
          const count = (pushAttempts.get(message.token) ?? 0) + 1;
          pushAttempts.set(message.token, count);
          if (message.token === "fixture-push-retry" && count === 1) return Response.json({}, { status: 503 });
          if (message.token === "fixture-push-unregistered") return Response.json({
            error: { details: [{ errorCode: "UNREGISTERED" }] }
          }, { status: 404 });
          return Response.json({ name: "fixture-accepted" });
        }
        assert.equal(request.url, keysUrl);
        certificateRequests += 1;
        return Response.json({ [keyId]: signingCert }, { headers: { "Cache-Control": "max-age=300" } });
      }
    }));

    async function request(path, status, { body, accessToken, method = body === undefined ? "GET" : "POST" } = {}) {
      const response = await worker.dispatchFetch(`http://127.0.0.1${path}`, {
        method,
        headers: {
          ...(body !== undefined && { "Content-Type": "application/json" }),
          ...(accessToken && { Authorization: `Bearer ${accessToken}` })
        },
        ...(body !== undefined && { body: JSON.stringify(body) })
      });
      const result = await response.text();
      assert.ok([status].flat().includes(response.status), `${path} returned ${response.status}: ${result}`);
      return JSON.parse(result);
    }

    assert.equal((await request("/health", 200)).ok, true);
    const emulatorHealth = await worker.dispatchFetch("http://10.0.2.2/health");
    assert.equal(emulatorHealth.status, 200);
    assert.equal((await emulatorHealth.json()).ok, true);
    assert.equal((await request("/ready", 503)).error.code, "D1_SCHEMA_UNAVAILABLE");
    assert.equal((await request("/api/auth/google", 503, { body: {} })).error.code, "D1_SCHEMA_UNAVAILABLE");
    const db = await worker.getD1Database(binding.binding);
    const schema = await readFile(pathFromHere("../../api/migrations/d1/0001_initial.sql"), "utf8");
    const olderSchema = schema.replace(/,\r?\n  "edit_token" TEXT/, "");
    assert.notEqual(olderSchema, schema);
    await db.batch(unstable_splitSqlQuery(olderSchema).map(sql => db.prepare(sql)));
    assert.equal((await request("/api/auth/google", 503, { body: {} })).error.code, "D1_SCHEMA_UNAVAILABLE");
    await db.prepare("ALTER TABLE user_auth_profile ADD COLUMN edit_token TEXT").run();
    const runtimeMigrations = ["0003_direct_message_indexes", "0004_direct_message_writes", "0005_clan_chat_indexes", "0006_scheduled_maintenance",
      "0007_notification_push_jobs", "0008_wallet_purchase_indexes", "0009_app_config_key_unique", "0010_support_ticket_sender",
      "0011_room_poll_indexes", "0012_room_invite_index", "0013_room_activity_indexes", "0014_room_message_progression",
      "0015_room_mode_state", "0016_pk_room_history_indexes", "0017_report_review_indexes", "0018_gift_catalog_indexes",
      "0019_room_gift_transfers", "0020_wishlist_unique", "0021_user_mission_unique", "0022_referral_unique",
      "0023_subscription_unique", "0024_event_participants_unique", "0025_dating_swipes",
      "0026_vibe_graph_unique", "0027_group_participants_unique", "0028_story_views_unique", "0029_social_unique",
      "0030_experience_claim_unique"];
    for (const file of runtimeMigrations) {
      const migration = await readFile(pathFromHere(`../../api/migrations/d1/${file}.sql`), "utf8");
      await db.batch(unstable_splitSqlQuery(migration).map(sql => db.prepare(sql)));
    }
    assert.equal((await request("/ready", 200)).storage, "d1");
    assert.equal((await worker.dispatchFetch("http://yugm.example/health")).status, 404);
    await request("/api/users", 404);

    const obsoleteWorkerConfig = {
      modulesRoot: directory,
      modules: [{ type: "ESModule", path: join(directory, "authLocal.js") }],
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      bindings: { ...config.vars, FCM_PROJECT_ID: project, JWT_SECRET: randomBytes(32).toString("hex") },
      d1Databases: { [binding.binding]: binding.database_id },
      cf: false
    };
    legacyWorker = new Miniflare(convertV4MiniflareOptions(obsoleteWorkerConfig));
    const obsoleteReady = await legacyWorker.dispatchFetch("http://127.0.0.1/ready");
    assert.equal(obsoleteReady.status, 503);
    assert.equal((await obsoleteReady.json()).error.code, "D1_CONFIG_REQUIRED");
    await legacyWorker.setOptions(convertV4MiniflareOptions({
      ...obsoleteWorkerConfig,
      bindings: { ...obsoleteWorkerConfig.bindings, MONGODB_URI: "mongodb://127.0.0.1:27017" }
    }));
    const legacyReady = await legacyWorker.dispatchFetch("http://127.0.0.1/ready");
    assert.equal(legacyReady.status, 503);
    assert.match(await legacyReady.text(), /isolated D1 configuration/);

    function signIn(emailVerified, audience = project, status = 200, account = "worker-fixture-uid", provider = "email") {
      const idToken = jwt.sign({
        email: `${account}@example.test`,
        email_verified: emailVerified,
        auth_time: Math.floor(Date.now() / 1000),
        firebase: { sign_in_provider: provider === "google" ? "google.com" : "password" }
      }, privateKey, {
        algorithm: "RS256", keyid: keyId, issuer: `https://securetoken.google.com/${project}`,
        audience, subject: account, expiresIn: "5m"
      });
      return request("/api/auth/google", status, { body: { idToken, acceptTerms: true, provider } });
    }
    assert.equal((await signIn(true, "another-fixture-project", 401)).error.code, "VALIDATION");
    assert.equal((await signIn(false, project, 403)).error.code, "FORBIDDEN");
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM users").first("total"), 0);
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM auth_sessions").first("total"), 0);

    const { data: first } = await signIn(true);
    assert.equal(first.isNewUser, true);
    assert.equal(first.user.profileCompleted, false);
    assert.equal(first.user.emailVerified, true);
    assert.equal(first.user.walletBalance, 250);
    assert.equal(first.token, first.accessToken);
    assert.equal((await request("/api/auth/me", 200, first)).data.user.id, first.user.id);
    assert.equal(await db.prepare("SELECT firebase_uid FROM users WHERE source_id = ?").bind(first.user.id).first("firebase_uid"), "worker-fixture-uid");
    assert.equal(await db.prepare("SELECT refresh_hash FROM auth_sessions WHERE source_id = ?").bind(first.sessionId).first("refresh_hash"), hash(first.refreshToken));

    const { data: rotated } = await request("/api/auth/refresh", 200, { body: { refreshToken: first.refreshToken } });
    assert.notEqual(rotated.sessionId, first.sessionId);
    assert.notEqual(rotated.refreshToken, first.refreshToken);
    const priorSession = await db.prepare("SELECT replaced_by_hash, revoked_at FROM auth_sessions WHERE source_id = ?").bind(first.sessionId).first();
    assert.equal(priorSession.replaced_by_hash, hash(rotated.refreshToken));
    assert.ok(priorSession.revoked_at);
    await request("/api/auth/me", 401, first);
    assert.equal((await request("/api/auth/me", 200, rotated)).data.user.id, first.user.id);
    assert.equal((await request("/api/auth/logout", 200, {
      accessToken: rotated.accessToken, body: { refreshToken: rotated.refreshToken }
    })).data.loggedOut, true);
    await request("/api/auth/me", 401, rotated);
    assert.equal((await request("/api/users/me", 401, rotated)).error.message, "Session revoked");
    await request("/api/auth/refresh", 401, { body: { refreshToken: rotated.refreshToken } });
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM auth_sessions WHERE revoked_at IS NULL").first("total"), 0);

    const { data: returning } = await signIn(true, project, 200, "worker-fixture-uid", "google");
    assert.equal(returning.user.id, first.user.id);
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM users").first("total"), 1);
    assert.ok(certificateRequests > 0);

    const own = (await request("/api/users/me", 200, returning)).data.user;
    assert.equal(own._id, first.user.id);
    assert.equal(own.walletBalance, 250);
    assert.equal(Object.hasOwn(own, "email"), false);
    const { data: visitor } = await signIn(true, project, 200, "second-worker-fixture-uid");
    const peer = (await request(`/api/users/${own._id}`, 200, visitor)).data.user;
    assert.equal(peer._id, own._id);
    assert.equal(Object.hasOwn(peer, "walletBalance"), false);
    const visit = db.prepare("SELECT visitor_id FROM profile_visits WHERE profile_id = ? AND visitor_id = ?")
      .bind(own._id, visitor.user.id);
    const deadline = Date.now() + 2_000;
    let storedVisit;
    do {
      storedVisit = await visit.first("visitor_id");
      if (!storedVisit) await delay(25);
    } while (!storedVisit && Date.now() < deadline);
    assert.equal(storedVisit, visitor.user.id);
    await request(`/api/users/public/${own._id}`, 401);
    const edit = (status, body, accessToken = returning.accessToken) => request("/api/users/me", status, { method: "PATCH", body, accessToken });
    assert.equal((await edit(401, { bio: "revoked session" }, rotated.accessToken)).error.message, "Session revoked");
    assert.equal((await edit(422, { age: 17 })).error.code, "VALIDATION");
    assert.equal((await edit(409, { username: visitor.user.username })).error.code, "CONFLICT");

    await db.prepare("UPDATE users SET xp = 90 WHERE source_id = ?").bind(own._id).run();
    // Mirrors UserApi.updateProfile in the Android debug app: generated avatars
    // are sent as an avatarParts object inside the same PATCH /users/me call.
    const generatedAvatarParts = { background: 3, clothes: 12, head: 21, mouth: 5, eyes: 9, top: 30 };
    const details = {
      name: "  Worker Fixture  ", username: " WORKER_UPDATED ", age: 23, gender: "Female", bio: " A profile ", city: "Pune",
      lookingFor: "Friendship", languages: ["English", " english "], interests: [" Music ", "Art"], acceptTerms: true,
      walletBalance: 99999, avatarType: "GENERATED", avatarParts: generatedAvatarParts
    };
    const completed = await Promise.all([edit(200, details), edit(200, details)]);
    const awards = completed.flatMap(result => result.data.xpGrant ? [result.data.xpGrant] : []);
    assert.equal(awards.length, 1);
    assert.equal(awards[0].event, "PROFILE_COMPLETE");
    assert.equal(awards[0].xpAwarded, 80);
    assert.equal(awards[0].levelUp, true);
    assert.ok(awards[0].levelUpReward > 0);
    for (const { data } of completed) {
      assert.equal(data.user.id, own._id);
      assert.equal(data.user.name, "Worker Fixture");
      assert.equal(data.user.username, "worker_updated");
      assert.equal(data.user.profileCompleted, true);
      assert.deepEqual(data.user.languages, ["English"]);
      assert.equal(data.user.walletBalance, 250 + awards[0].levelUpReward);
      assert.equal(data.user.avatarType, "GENERATED");
      assert.deepEqual(data.user.avatarParts, generatedAvatarParts);
    }
    const afterCompletion = (await request("/api/users/me", 200, returning)).data.user;
    assert.equal(afterCompletion.xp, 170);
    assert.equal(afterCompletion.avatarType, "GENERATED");
    assert.deepEqual(afterCompletion.avatarParts, generatedAvatarParts);
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM xp_grants WHERE user_id = ?").bind(own._id).first("total"), 1);
    assert.equal(await db.prepare("SELECT xp FROM battle_passes WHERE user_id = ?").bind(own._id).first("xp"), 80);
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM battle_pass_xp_grants WHERE user_id = ?").bind(own._id).first("total"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?").bind(own._id).first("total"), 1);
    assert.deepEqual(await db.prepare("SELECT amount, balance_before, balance_after FROM wallet_transactions WHERE user_id = ?").bind(own._id).first(), {
      amount: awards[0].levelUpReward, balance_before: 250, balance_after: 250 + awards[0].levelUpReward
    });

    const [legacyResult] = await Promise.all([
      edit(200, { hobbies: ["Music"], bio: "   ", avatarType: "DEFAULT" }),
      edit(200, { vibeLine: "Independent change" })
    ]);
    const legacyEdit = legacyResult.data;
    assert.equal(Object.hasOwn(legacyEdit, "xpGrant"), false);
    assert.deepEqual(legacyEdit.user.hobbies, ["Music"]);
    assert.equal(legacyEdit.user.bio, "A profile");
    assert.equal(legacyEdit.user.avatarParts, null);
    const afterEdits = (await request("/api/users/me", 200, returning)).data.user;
    const aliasEdit = (await request("/api/auth/profile", 200, {
      accessToken: returning.accessToken, method: "PATCH", body: { bio: afterEdits.bio ?? "" }
    })).data;
    assert.equal(aliasEdit.user.id, returning.user.id);
    assert.equal(aliasEdit.user.email, returning.user.email);
    assert.equal(aliasEdit.xpGrant, undefined);
    assert.deepEqual(afterEdits.hobbies, ["Music"]);
    assert.equal(afterEdits.vibeLine, "Independent change");
    assert.equal((await request("/api/auth/me", 200, returning)).data.user.profileCompleted, true);

    await db.prepare(`INSERT INTO battle_passes
      (source_id, season_id, season_name, user_id, tier, level, xp, premium, expires_at)
      SELECT '000000000000000000000099', source_id, name, ?, 'premium', 1, 75, 1, end_date FROM seasons WHERE active = 1`)
      .bind(visitor.user.id).run();
    await edit(200, { ...details, username: "worker_visitor" }, visitor.accessToken);
    assert.deepEqual(await db.prepare("SELECT level, xp, premium FROM battle_passes WHERE user_id = ?").bind(visitor.user.id).first(),
      { level: 2, xp: 55, premium: 1 });
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM seasons WHERE active = 1").first("total"), 1);

    // Managed R2-backed avatar slice: grant -> staging PUT -> completion -> profile commit.
    const avatarPng = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#3b82f6" } })
      .png().toBuffer();
    const createUpload = (bytes, fileName = "avatar.png") => request("/api/media/uploads", 201, {
      body: { category: "AVATAR", contentType: "image/png", bytes, fileName },
      accessToken: returning.accessToken
    });
    assert.equal((await request("/api/media/uploads", 400, {
      body: { category: "COVER", contentType: "image/png", bytes: 4, fileName: "cover.png" },
      accessToken: returning.accessToken
    })).error.message, "This media category is not yet available through managed uploads");

    const { data: grant } = await createUpload(avatarPng.byteLength);
    assert.match(grant.sessionId, /^[a-f0-9-]{36}$/);
    assert.match(grant.uploadUrl, /^http:\/\/127\.0\.0\.1\/api\/media\/uploads\/[a-f0-9-]{36}\/bytes\?grant=/);
    assert.equal(grant.method, "PUT");
    assert.equal(grant.requiredHeaders["Content-Type"], "image/png");
    assert.equal(grant.expiresIn, 900);
    assert.equal(grant.maxBytes, 5 * 1024 * 1024);
    assert.equal(grant.category, "AVATAR");
    const pendingSession = await db.prepare(`SELECT user_id, status, staging_key, quota_reserved, upload_token_hash
      FROM media_upload_sessions WHERE source_id = ?`).bind(grant.sessionId).first();
    assert.equal(pendingSession.user_id, returning.user.id);
    assert.equal(pendingSession.status, "PENDING");
    assert.equal(pendingSession.quota_reserved, 1);
    assert.match(pendingSession.staging_key, /^staging\/[a-f0-9-]{36}\/original\.png$/);
    assert.ok(pendingSession.upload_token_hash);
    assert.equal(pendingSession.upload_token_hash.length, 64);

    const staging = await worker.getR2Bucket("STAGING");
    const uploadUrl = new URL(grant.uploadUrl);
    const staged = await worker.dispatchFetch(uploadUrl.toString(), {
      method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(avatarPng)
    });
    assert.equal(staged.status, 204, await staged.text());
    assert.ok(await staging.head(pendingSession.staging_key));
    const forged = await worker.dispatchFetch(`${uploadUrl.origin}${uploadUrl.pathname}?grant=forged`, {
      method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(avatarPng)
    });
    assert.equal(forged.status, 403);

    const { data: completedUpload } = await request(`/api/media/uploads/${grant.sessionId}/complete`, 200,
      { body: {}, accessToken: returning.accessToken });
    assert.equal(completedUpload.mediaType, "IMAGE");
    assert.equal(completedUpload.version, 1);
    assert.match(completedUpload.avatarUrl,
      new RegExp(`^http://127\\.0\\.0\\.1/api/media/public/${completedUpload.mediaId}/avatar_256\\.webp$`));
    assert.deepEqual((await request(`/api/media/uploads/${grant.sessionId}/complete`, 200,
      { body: {}, accessToken: returning.accessToken })).data, completedUpload);
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM media_objects").first("total"), 1);
    assert.equal((await request(`/api/media/uploads/${grant.sessionId}/complete`, 404,
      { body: {}, accessToken: visitor.accessToken })).error.message, "Upload session not found");

    const storedAvatar = (await request("/api/users/me", 200, returning)).data.user;
    assert.equal(storedAvatar.avatar, completedUpload.avatarUrl);
    assert.equal(storedAvatar.avatarType, "UPLOADED");
    assert.equal(storedAvatar.avatarParts, null);
    assert.equal(storedAvatar.activeCosmetics.avatarAsset, "");
    assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM media_variants WHERE media_objects_id = ?")
      .bind(completedUpload.mediaId).first("total"), 4);
    const originalVariant = await db.prepare(`SELECT bucket, key FROM media_variants
      WHERE media_objects_id = ? AND name = 'original'`).bind(completedUpload.mediaId).first();
    assert.equal(originalVariant.bucket, "originals");
    assert.match(originalVariant.key, /^users\/[a-z0-9_-]+\/avatars\/[a-z0-9_-]+\/original\.png$/);
    const mediaRow = await db.prepare(`SELECT storage_key, content_type, file_size, width, height
      FROM media_objects WHERE source_id = ?`).bind(completedUpload.mediaId).first();
    assert.match(mediaRow.storage_key, /avatar_256\.webp$/);
    assert.equal(mediaRow.content_type, "image/png");
    assert.equal(mediaRow.file_size, avatarPng.byteLength);
    assert.equal(mediaRow.width, 32);
    assert.equal(mediaRow.height, 24);
    const publicVariant = await worker.dispatchFetch(completedUpload.avatarUrl);
    assert.equal(publicVariant.status, 200);
    assert.equal(publicVariant.headers.get("content-type"), "image/webp");
    assert.equal(publicVariant.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.ok((await publicVariant.arrayBuffer()).byteLength > 0);
    const { data: privateGrant } = await request(`/api/media/${completedUpload.mediaId}/download`, 200,
      { accessToken: returning.accessToken });
    const original = await worker.dispatchFetch(privateGrant.downloadUrl);
    assert.equal(original.status, 200);
    assert.equal(original.headers.get("cache-control"), "private, no-store");
    assert.equal((await original.arrayBuffer()).byteLength, avatarPng.byteLength);
    assert.equal((await request(`/api/media/${completedUpload.mediaId}/download`, 401)).error.code, "UNAUTHORIZED");
    assert.equal((await request("/api/media/not-a-media-id/download", 400,
      { accessToken: returning.accessToken })).error.message, "Invalid media id");

    const { data: cancelGrant } = await createUpload(avatarPng.byteLength);
    const cancelledSession = await db.prepare("SELECT staging_key FROM media_upload_sessions WHERE source_id = ?")
      .bind(cancelGrant.sessionId).first();
    const cancelled = (await request(`/api/media/uploads/${cancelGrant.sessionId}`, 200,
      { method: "DELETE", accessToken: returning.accessToken })).data;
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal((await request(`/api/media/uploads/${cancelGrant.sessionId}`, 200,
      { method: "DELETE", accessToken: returning.accessToken })).data.status, "CANCELLED");
    assert.equal(await db.prepare("SELECT quota_reserved FROM media_upload_sessions WHERE source_id = ?")
      .bind(cancelGrant.sessionId).first("quota_reserved"), 0);
    assert.equal(await staging.head(cancelledSession.staging_key), null);
    assert.equal((await request(`/api/media/uploads/${cancelGrant.sessionId}/complete`, 409,
      { body: {}, accessToken: returning.accessToken })).error.code, "CONFLICT");

    const { data: expiredGrant } = await createUpload(avatarPng.byteLength);
    await db.prepare("UPDATE media_upload_sessions SET expires_at = ? WHERE source_id = ?")
      .bind(new Date(Date.now() - 1000).toISOString(), expiredGrant.sessionId).run();
    assert.equal((await request(`/api/media/uploads/${expiredGrant.sessionId}/complete`, 410,
      { body: {}, accessToken: returning.accessToken })).error.message, "Upload session has expired");
    assert.equal(await db.prepare("SELECT quota_reserved FROM media_upload_sessions WHERE source_id = ?")
      .bind(expiredGrant.sessionId).first("quota_reserved"), 0);

    const { data: invalidGrant } = await createUpload(4);
    const invalidPut = await worker.dispatchFetch(new URL(invalidGrant.uploadUrl).toString(), {
      method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(Buffer.from("nope"))
    });
    assert.equal(invalidPut.status, 204);
    assert.equal((await request(`/api/media/uploads/${invalidGrant.sessionId}/complete`, 400,
      { body: {}, accessToken: returning.accessToken })).error.message, "Uploaded file is not a supported image");
    assert.equal(await db.prepare("SELECT status FROM media_upload_sessions WHERE source_id = ?")
      .bind(invalidGrant.sessionId).first("status"), "FAILED");
    assert.equal(await db.prepare("SELECT quota_reserved FROM media_upload_sessions WHERE source_id = ?")
      .bind(invalidGrant.sessionId).first("quota_reserved"), 0);

    const catalogPath = "/api/wallet/cosmetics";
    const inventoryPath = "/api/users/me/inventory";
    const equipPath = `${catalogPath}/equip`;
    await request(catalogPath, 401);
    await request(inventoryPath, 401, rotated);
    const { data: initialCatalog } = await request(catalogPath, 200, returning);
    const cosmetic = initialCatalog.cosmetics.find(item => item.type === "AVATAR_FRAME");
    assert.ok(cosmetic);
    assert.deepEqual(initialCatalog.ownedCosmeticIds, []);
    const initialWallet = (await request("/api/wallet", 200, returning)).data;
    assert.equal(initialWallet.balance, (await request("/api/users/me", 200, returning)).data.user.walletBalance);
    assert.equal(initialWallet.dailyReward.coinReward, 25);
    assert.equal(initialWallet.dailyReward.canClaim, true);

    const userId = returning.user.id;
    const rewardId = "local-bond-reward";
    const inactiveId = "local-inactive-frame";
    const assetId = randomBytes(12).toString("hex");
    const objectKey = "assets/local-cosmetic-full.png";
    const pendingKey = "assets/local-cosmetic-unpublished.png";
    const assetBucket = await worker.getR2Bucket("ASSETS");
    await assetBucket.put(objectKey, new Uint8Array(avatarPng), { httpMetadata: { contentType: "image/png" } });
    await assetBucket.put(pendingKey, new Uint8Array(avatarPng), { httpMetadata: { contentType: "image/png" } });
    await db.batch([
      db.prepare(`INSERT INTO assets
        (source_id, owner_type, owner_id, kind, status, version, original_name, mime_type, bytes, width, height,
         sha256, staging_key, staging_url, public_key, public_url, created_by)
        VALUES (?, 'cosmetic', ?, 'IMAGE', 'published', 1, 'fixture.png', 'image/png', ?, 32, 24, ?, ?, '', ?, ?, 'local-fixture')`)
        .bind(assetId, cosmetic.id, avatarPng.byteLength, hash(avatarPng), pendingKey, objectKey, "https://legacy.example/art.png"),
      db.prepare(`INSERT INTO asset_variants
        (source_id, name, key, url, content_type, bytes, width, height, assets_id, position)
        VALUES (?, 'full', ?, '', 'image/png', ?, 32, 24, ?, 0), (?, 'unpublished', ?, '', 'image/png', ?, 32, 24, ?, 1)`)
        .bind(`${assetId}:full`, objectKey, avatarPng.byteLength, assetId, `${assetId}:unpublished`, pendingKey, avatarPng.byteLength, assetId),
      db.prepare("UPDATE cosmetics SET name = 'Edited locally', asset_ref = ? WHERE source_id = ?").bind(assetId, cosmetic.id),
      db.prepare(`INSERT INTO cosmetics (source_id, type, name, coin_price, rarity, preview, is_active, reward_only)
        VALUES (?, 'AVATAR_FRAME', 'Bond reward', 0, 'RARE', '', 1, 1), (?, 'AVATAR_FRAME', 'Retired frame', 100, 'COMMON', '', 0, 0)`)
        .bind(rewardId, inactiveId),
      db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
        VALUES (?, ?, ?, 0), (?, ?, ?, 1), (?, ?, ?, 2)`)
        .bind(`${userId}:owned:0`, cosmetic.id, userId, `${userId}:owned:1`, rewardId, userId, `${userId}:owned:2`, inactiveId, userId),
      db.prepare(`INSERT INTO user_claimed_achievement_tiers
        (source_id, achievement_id, tier, claimed_at, users_id, position) VALUES (?, 'test-badge', 'BRONZE', ?, ?, 0)`)
        .bind(`${userId}:claimed:0`, new Date().toISOString(), userId)
    ]);

    const { data: ownedCatalog } = await request(catalogPath, 200, returning);
    assert.deepEqual(ownedCatalog.ownedCosmeticIds, [cosmetic.id, rewardId, inactiveId]);
    assert.ok(ownedCatalog.cosmetics.some(item => item.id === rewardId));
    assert.ok(!ownedCatalog.cosmetics.some(item => item.id === inactiveId));
    const managed = ownedCatalog.cosmetics.find(item => item.id === cosmetic.id);
    assert.equal(managed.name, "Edited locally");
    assert.equal(managed.assetId, assetId);
    assert.equal(managed.assetVersion, 1);
    assert.equal(managed.assetVariants.length, 1);
    assert.equal(managed.assetVariants[0].url, managed.assetUrl);
    assert.equal(managed.assetUrl, `http://127.0.0.1/api/assets/published/${assetId}/full`);
    const image = await worker.dispatchFetch(managed.assetUrl);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), avatarPng);
    const imageHead = await worker.dispatchFetch(managed.assetUrl, { method: "HEAD" });
    assert.equal(imageHead.status, 200);
    assert.equal(imageHead.headers.get("content-length"), String(avatarPng.byteLength));
    assert.equal((await worker.dispatchFetch(managed.assetUrl.replace(/full$/, "unpublished"))).status, 404);
    await db.prepare("UPDATE assets SET status = 'archived' WHERE source_id = ?").bind(assetId).run();
    assert.equal((await worker.dispatchFetch(managed.assetUrl)).status, 404);
    assert.equal((await request(catalogPath, 200, returning)).data.cosmetics.find(item => item.id === cosmetic.id).assetId, undefined);

    const otherCatalog = (await request(catalogPath, 200, visitor)).data;
    assert.deepEqual(otherCatalog.ownedCosmeticIds, []);
    assert.ok(!otherCatalog.cosmetics.some(item => item.id === rewardId));
    const equip = (status, account, cosmeticId, type = cosmetic.type) =>
      request(equipPath, status, { accessToken: account.accessToken, body: { cosmeticId, type } });
    assert.equal((await equip(403, visitor, cosmetic.id)).error.message, "Cosmetic is not owned");
    assert.equal((await equip(400, returning, cosmetic.id, "PROFILE_THEME")).error.message, "Cosmetic type mismatch");
    const { data: equipped } = await equip(200, returning, cosmetic.id);
    assert.equal(equipped.activeCosmetics.avatarFrame, cosmetic.id);
    assert.equal(equipped.balance, initialWallet.balance);
    assert.equal((await request("/api/users/me", 200, returning)).data.user.activeCosmetics.avatarFrame, cosmetic.id);
    assert.equal((await request(`/api/users/${userId}`, 200, visitor)).data.user.activeCosmetics.avatarFrame, cosmetic.id);
    const inventory = (await request(inventoryPath, 200, returning)).data;
    assert.equal(inventory.summary.totalCosmetics, 3);
    assert.equal(inventory.summary.equippedCosmetics, 1);
    assert.ok(inventory.cosmetics.find(item => item.id === cosmetic.id).isEquipped);
    assert.ok(inventory.cosmetics.some(item => item.id === inactiveId));
    assert.equal(inventory.summary.totalBadges, 1);
    assert.equal(inventory.badges[0].title, "test-badge");
    assert.deepEqual((await request(inventoryPath, 200, visitor)).data.cosmetics, []);

    await equip(200, returning, "");
    const cleared = (await request("/api/users/me", 200, returning)).data.user;
    assert.equal(cleared.activeCosmetics.avatarFrame, undefined);
    assert.equal(cleared.avatar, completedUpload.avatarUrl);

    const purchaseId = "local-purchase-frame";
    const costlyId = "local-expensive-frame";
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    await db.batch([
      db.prepare(`INSERT INTO cosmetics (source_id, type, name, coin_price, rarity, preview, is_active, reward_only)
        VALUES (?, 'AVATAR_FRAME', 'Local frame', 50, 'COMMON', '', 1, 0),
               (?, 'AVATAR_FRAME', 'Expensive frame', 100000, 'COMMON', '', 1, 0)`).bind(purchaseId, costlyId),
      db.prepare("UPDATE users SET wallet_balance = 1000 WHERE source_id = ?").bind(userId),
      db.prepare(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount)
        VALUES (?, ?, 'COSMETIC_PURCHASE', ?, 246)`).bind(`${userId}:daily-cosmetic-cap`, userId, day.toISOString()),
      db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
        SELECT ?, 'frame_minimal', ?, 3 WHERE NOT EXISTS (
          SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = 'frame_minimal'
        )`).bind(`${userId}:owned:starter`, userId, userId)
    ]);
    const buy = (status, cosmeticId) => request(`${catalogPath}/purchase`, status,
      { accessToken: returning.accessToken, body: { cosmeticId } });
    assert.equal((await buy(402, costlyId)).error.code, "INSUFFICIENT_FUNDS");
    assert.equal((await buy(403, rewardId)).error.code, "FORBIDDEN");
    const safetyId = randomBytes(12).toString("hex");
    await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level, warning_count,
      report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen)
      VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1)`).bind(safetyId, userId).run();
    assert.equal((await buy(403, purchaseId)).error.message, "Wallet is frozen");
    await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();

    await db.prepare(`CREATE TRIGGER fixture_xp_failure BEFORE INSERT ON xp_grants
      WHEN NEW.event = 'COSMETIC_PURCHASE' BEGIN SELECT RAISE(ABORT, 'fixture XP failure'); END`).run();
    await buy(500, purchaseId);
    await db.prepare("DROP TRIGGER fixture_xp_failure").run();
    assert.equal((await request("/api/wallet", 200, returning)).data.balance, 1000);
    assert.equal(await db.prepare("SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = ?")
      .bind(userId, purchaseId).first(), null);

    const purchases = await Promise.all([buy([200, 201], purchaseId), buy([200, 201], purchaseId)]);
    const awarded = purchases.find(({ data }) => data.xpGrant).data;
    assert.equal(purchases.filter(({ data }) => data.xpGrant).length, 1);
    assert.equal(awarded.xpGrant.xpAwarded, 54);
    assert.equal(awarded.xpGrant.earnedToday, 300);
    assert.equal(awarded.xpGrant.capped, true);
    assert.equal(awarded.activeCosmetics.avatarFrame, purchaseId);
    assert.equal(awarded.balance, 950 + awarded.xpGrant.levelUpReward);
    const debit = await db.prepare(`SELECT amount, balance_before, balance_after FROM wallet_transactions
      WHERE user_id = ? AND source = 'PROFILE_COSMETIC_PURCHASE'`).bind(userId).all();
    assert.equal(debit.results.length, 1);
    assert.equal(debit.results[0].amount, 50);
    assert.equal(debit.results[0].balance_before, 1000);
    assert.equal(debit.results[0].balance_after, 950);

    const buyBundle = status => request(`${catalogPath}/bundle-purchase`, status,
      { accessToken: returning.accessToken, body: { bundleId: "bundle_vibe_starter" } });
    const bundlePurchase = (await buyBundle(200)).data;
    assert.deepEqual(bundlePurchase.newCosmetics, ["mood_chill", "bubble_rounded"]);
    assert.equal(bundlePurchase.balance, awarded.balance - 399);
    assert.equal(bundlePurchase.xpGrant.xpAwarded, 0);
    assert.equal(bundlePurchase.xpGrant.capped, true);
    assert.equal(bundlePurchase.activeCosmetics.avatarFrame, purchaseId);
    await buyBundle(409);

    const transfer = (status, cosmeticId, receiverId) => request(`${catalogPath}/transfer`, status,
      { accessToken: returning.accessToken, body: { cosmeticId, receiverId } });
    await transfer(404, purchaseId, randomBytes(12).toString("hex"));
    await transfer(403, rewardId, visitor.user.id);
    assert.equal((await request("/api/users/me", 200, returning)).data.user.activeCosmetics.avatarFrame, purchaseId);
    assert.equal((await transfer(200, purchaseId, visitor.user.id)).data.transferred, true);
    await transfer(403, purchaseId, visitor.user.id);
    assert.ok(!(await request(inventoryPath, 200, returning)).data.cosmetics.some(item => item.id === purchaseId));
    assert.ok((await request(inventoryPath, 200, visitor)).data.cosmetics.some(item => item.id === purchaseId && !item.isEquipped));
    assert.equal((await request("/api/users/me", 200, returning)).data.user.activeCosmetics.avatarFrame, undefined);
    const notificationsPath = "/api/notifications";
    const received = (await request(notificationsPath, 200, visitor)).data;
    const receivedGift = received.notifications.filter(item => item.type === "GIFT" && item.title === "Cosmetic Gift");
    assert.equal(receivedGift.length, 1);
    assert.equal(receivedGift[0].userId, visitor.user.id);
    assert.equal(receivedGift[0].data.cosmeticId, purchaseId);
    assert.equal(receivedGift[0].read, false);
    const readPath = `${notificationsPath}/${receivedGift[0]._id}/read`;
    await request(readPath, 404, { accessToken: returning.accessToken, method: "PATCH", body: {} });
    const readGift = (await request(readPath, 200, { accessToken: visitor.accessToken, method: "PATCH", body: {} })).data.notification;
    assert.equal(readGift.read, true);
    assert.equal((await request(notificationsPath, 200, visitor)).data.unreadCount, received.unreadCount - 1);

    const clanRoot = "/api/clans";
    await request(clanRoot, 401, rotated);
    assert.equal((await request(`${clanRoot}/me`, 200, returning)).data.clan, null);
    const createClan = (status, account, name, privacy) => request(clanRoot, status, {
      accessToken: account.accessToken, body: { name, privacy, familyLabel: "Family" }
    });
    const clan = (await createClan(201, returning, "Yugm Local Clan", "PUBLIC")).data.clan;
    assert.equal(clan.myRole, "LEADER");
    assert.equal(clan.memberCount, 1);
    assert.equal(clan.members[0]._id, userId);
    assert.equal((await request("/api/users/me", 200, returning)).data.user.clanId, clan.id);
    await createClan(400, returning, "Other Local Clan", "PUBLIC");
    const list = (await request(`${clanRoot}?q=LOCAL%20clan`, 200, visitor)).data.clans;
    assert.deepEqual(list.map(item => item.id), [clan.id]);
    assert.deepEqual(list[0].members, []);
    const ranking = (await request(`${clanRoot}/leaderboard`, 200, visitor)).data.clans;
    assert.equal(ranking[0].id, clan.id);
    assert.equal(ranking[0].rank, 1);
    const action = (status, account, path, body = {}) => request(`${clanRoot}/${clan.id}/${path}`, status,
      { accessToken: account.accessToken, body });
    const joins = await Promise.all([action([200, 400], visitor, "join"), action([200, 400], visitor, "join")]);
    const joined = joins.find(result => result.ok).data.clan;
    assert.equal(joins.filter(result => result.ok).length, 1);
    assert.equal(joined.memberCount, 2);
    assert.equal(joined.myRole, "MEMBER");
    assert.equal((await request("/api/users/me", 200, visitor)).data.user.clanId, clan.id);
    const memberAction = (status, account, memberId, role) => request(
      `${clanRoot}/${clan.id}/members/${memberId}${role ? "/role" : ""}`, status, {
        accessToken: account.accessToken, method: role ? "PATCH" : "DELETE", ...(role && { body: { role } })
      }
    );
    const deleteClan = (status, account, id = clan.id) => request(`${clanRoot}/${id}`, status,
      { accessToken: account.accessToken, method: "DELETE" });
    await memberAction(400, returning, userId, "OFFICER");
    await memberAction(403, visitor, visitor.user.id, "OFFICER");
    const promoted = (await memberAction(200, returning, visitor.user.id, "OFFICER")).data.clan;
    assert.equal(promoted.memberRoles.find(item => item.userId === visitor.user.id).role, "OFFICER");
    await memberAction(400, visitor, userId);
    await deleteClan(403, visitor);
    assert.equal((await action(400, returning, "leave")).error.message, "Transfer ownership before leaving this clan");
    await action(403, visitor, "transfer-ownership", { userId });
    await request(`${clanRoot}/${clan.id}`, 403, { accessToken: visitor.accessToken, method: "PATCH", body: { name: "Forbidden edit" } });
    const changedClan = (await request(`${clanRoot}/${clan.id}`, 200, {
      accessToken: returning.accessToken, method: "PATCH", body: { privacy: "PRIVATE" }
    })).data.clan;
    assert.equal(changedClan.privacy, "PRIVATE");
    assert.equal((await action(200, returning, "transfer-ownership", { userId: visitor.user.id })).data.clan.myRole, "CO_LEADER");
    assert.equal((await action(200, returning, "leave")).data.clan, null);
    assert.equal((await request("/api/users/me", 200, returning)).data.user.clanId, undefined);
    assert.deepEqual((await request(clanRoot, 200, returning)).data.clans, []);
    await request(`${clanRoot}/${clan.id}`, 404, returning);
    await action(403, returning, "join");
    assert.equal((await request(`${clanRoot}/me`, 200, visitor)).data.clan.myRole, "LEADER");
    assert.deepEqual((await request(`${clanRoot}/leaderboard`, 200, visitor)).data.clans, []);

    const sendInvite = async () => (await action(201, visitor, "invitations", { userId })).data.invitation;
    const invites = await Promise.all([sendInvite(), sendInvite()]);
    const inviteId = invites[0]._id;
    assert.equal(invites[1]._id, inviteId);
    assert.deepEqual((await request(`${clanRoot}/invitations`, 200, visitor)).data.invitations, []);
    const inbox = (await request(`${clanRoot}/invitations`, 200, returning)).data.invitations;
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].clanId._id, clan.id);
    assert.equal(inbox[0].inviterId._id, visitor.user.id);
    const sent = (await request(`${clanRoot}/${clan.id}/invitations`, 200, visitor)).data.invitations;
    assert.equal(sent[0].inviteeId._id, userId);
    const clanNotices = (await request(notificationsPath, 200, returning)).data.notifications;
    assert.equal(clanNotices.filter(item => item.data?.clanInviteId === inviteId).length, 1);
    await request(`${notificationsPath}/read-all`, 200, { accessToken: returning.accessToken, body: {} });
    assert.equal((await request(notificationsPath, 200, returning)).data.unreadCount, 0);
    const respondToInvite = (status, account, id, response) => request(`${clanRoot}/invitations/${id}/${response}`, status,
      { accessToken: account.accessToken, body: {} });
    await respondToInvite(404, visitor, inviteId, "accept");
    assert.equal((await respondToInvite(200, returning, inviteId, "decline")).data.invitation.status, "DECLINED");
    const cancelledInvite = (await sendInvite())._id;
    const cancelledClanInvite = (await request(`${clanRoot}/${clan.id}/invitations/${cancelledInvite}`, 200,
      { accessToken: visitor.accessToken, method: "DELETE" })).data.invitation;
    assert.equal(cancelledClanInvite.status, "CANCELLED");
    await respondToInvite(404, returning, cancelledInvite, "accept");
    const acceptedInvite = (await sendInvite())._id;
    const accepted = (await respondToInvite(200, returning, acceptedInvite, "accept")).data;
    assert.equal(accepted.invitation.status, "ACCEPTED");
    assert.equal(accepted.clan.memberCount, 2);
    assert.equal((await request("/api/users/me", 200, returning)).data.user.clanId, clan.id);
    await respondToInvite(404, returning, acceptedInvite, "accept");
    const pendingInvite = randomBytes(12).toString("hex");
    const future = new Date(Date.now() + 60000).toISOString();
    await db.prepare(`INSERT INTO clan_invites (source_id, clan_id, inviter_id, invitee_id, status, expires_at)
      VALUES (?, ?, ?, ?, 'PENDING', ?)`).bind(pendingInvite, clan.id, visitor.user.id, userId, future).run();
    const removed = (await memberAction(200, visitor, userId)).data.clan;
    assert.equal(removed.memberCount, 1);
    assert.ok(!removed.memberRoles.some(item => item.userId === userId));
    assert.equal((await request("/api/users/me", 200, returning)).data.user.clanId, undefined);
    assert.equal(await db.prepare("SELECT status FROM clan_invites WHERE source_id = ?").bind(pendingInvite).first("status"), "CANCELLED");
    const chat = `${clanRoot}/${clan.id}/messages`;
    await request(chat, 403, returning);
    const reinvited = (await sendInvite())._id;
    await respondToInvite(200, returning, reinvited, "accept");
    const clanMessage = randomBytes(12).toString("hex");
    await db.prepare(`INSERT INTO clan_messages (source_id, clan_id, sender_id, message, created_at)
      VALUES (?, ?, ?, 'clan fixture', '2025-01-01T00:00:00.000Z')`).bind(clanMessage, clan.id, userId).run();
    const sentMessage = (await request(chat, 201, { accessToken: visitor.accessToken, body: { message: "Hello family" } })).data.message;
    assert.equal(sentMessage.senderId._id, visitor.user.id);
    assert.deepEqual((await request(`${chat}?limit=1`, 200, returning)).data.messages.map(item => item._id), [sentMessage._id]);
    assert.deepEqual((await request(`${chat}?before=${encodeURIComponent(sentMessage.createdAt)}`, 200, returning)).data.messages.map(item => item._id), [clanMessage]);
    assert.equal(await db.prepare(`SELECT user_id FROM notifications WHERE title = 'New family message' AND json_extract(data, '$.messageId') = ?`)
      .bind(sentMessage._id).first("user_id"), userId);
    const react = () => request(`${chat}/${clanMessage}/reactions`, 200, { accessToken: visitor.accessToken, body: { type: "heart" } });
    assert.equal((await react()).data.message.reactions[0].userId, visitor.user.id);
    assert.deepEqual((await react()).data.message.reactions, []);
    assert.equal((await react()).data.message.reactions.length, 1);
    const report = (await request(`${chat}/${clanMessage}/report`, 201,
      { accessToken: visitor.accessToken, body: { reason: "Fixture report" } })).data.report;
    assert.equal(report.targetUserId, userId);
    assert.equal(report.evidence.clanMessageId, clanMessage);
    await request(`${chat}/${sentMessage._id}`, 403, { accessToken: returning.accessToken, method: "DELETE" });
    await request(`${chat}/${sentMessage._id}`, 200, { accessToken: visitor.accessToken, method: "DELETE" });
    await request(`${chat}/clean`, 403, { accessToken: returning.accessToken, body: {} });
    await db.prepare("CREATE TRIGGER fixture_reject_clan_delete BEFORE DELETE ON clans BEGIN SELECT RAISE(ABORT, 'fixture clan rollback'); END").run();
    try {
      await deleteClan(500, visitor);
      assert.equal((await request(`${clanRoot}/me`, 200, returning)).data.clan.memberCount, 2);
      assert.ok(await db.prepare("SELECT 1 FROM clan_message_reactions WHERE clan_messages_id = ?").bind(clanMessage).first());
    } finally {
      await db.prepare("DROP TRIGGER fixture_reject_clan_delete").run();
    }
    assert.equal((await deleteClan(200, visitor)).data.clan, null);
    assert.equal(await db.prepare("SELECT 1 FROM clans WHERE source_id = ?").bind(clan.id).first(), null);
    assert.equal(await db.prepare("SELECT 1 FROM clan_messages WHERE source_id = ?").bind(clanMessage).first(), null);
    assert.equal(await db.prepare("SELECT 1 FROM clan_message_reactions WHERE clan_messages_id = ?").bind(clanMessage).first(), null);
    assert.equal((await request(`${clanRoot}/me`, 200, returning)).data.clan, null);
    assert.equal((await request("/api/users/me", 200, visitor)).data.user.clanId, undefined);
    const leaveClan = (await createClan(201, visitor, "Yugm Leave Fixture", "PUBLIC")).data.clan;
    const otherChat = `${clanRoot}/${leaveClan.id}/messages`;
    await request(otherChat, 201, { accessToken: visitor.accessToken, body: { message: "Temporary clan message" } });
    assert.equal((await request(`${otherChat}/clean`, 200, { accessToken: visitor.accessToken, body: {} })).data.deletedCount, 1);
    const left = await request(`${clanRoot}/${leaveClan.id}/leave`, 200, { accessToken: visitor.accessToken, body: {} });
    assert.equal(left.data.clan, null);
    assert.equal(await db.prepare("SELECT 1 FROM clans WHERE source_id = ?").bind(leaveClan.id).first(), null);
    await verifyD1AppEndpoints(db, request, returning, visitor);
    await verifyD1Bonds(db, request, returning, visitor);
    await verifyD1Wallet(db, request, returning, visitor);
    assert.equal(googleConsumes, 1);
    await verifyD1WatchParty(db, request, returning, visitor);
    await verifyD1Admin(db, request, adminJwtSecret, returning.accessToken);
    assert.equal((await request("/", 200)).api, "/api");
    for (const [path, heading] of [
      ["privacy", "Privacy Policy"], ["terms", "Terms of Use"], ["child-safety", "Child Safety Standards"],
      ["account-deletion", "Request Account Deletion"], ["contact", "Contact Yugm"]
    ]) {
      const response = await worker.dispatchFetch(`http://127.0.0.1/legal/${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /^text\/html/);
      const html = await response.text();
      assert.ok(html.includes(`<h1>${heading}</h1>`));
      if (path === "account-deletion" || path === "contact") assert.ok(html.includes("/api/support/public-requests"));
    }
    await verifyD1AdminSupport(db, request, adminJwtSecret, returning, visitor);
    await verifyD1Progression(db, request, visitor);
    await verifyD1Themes(db, request, returning, visitor);
    await verifyD1RoomPolls(db, request, returning, visitor);
    await verifyD1RoomInvites(db, request, returning, visitor);
    await verifyD1RoomReactions(db, request, returning, visitor);
    const { data: chatHost } = await signIn(true, project, 200, "room-chat-host-fixture");
    const { data: chatGuest } = await signIn(true, project, 200, "room-chat-guest-fixture");
    await verifyD1RoomMessages(db, request, chatHost, chatGuest);
    await verifyD1RoomModes(db, request, chatHost, chatGuest, returning);
    await verifyD1RoomPkHistory(db, request, chatHost, chatGuest);
    await verifyD1Reports(db, request, adminJwtSecret, chatHost, returning, visitor, chatGuest);
    await verifyD1GiftCatalog(db, request, chatHost, chatGuest);
    await verifyD1RoomGifts(db, request, chatHost, chatGuest);
    const { data: feedOwner } = await signIn(true, project, 200, "feed-owner-fixture");
    const { data: feedVisitor } = await signIn(true, project, 200, "feed-visitor-fixture");
    await verifyD1Feed(db, request, feedOwner, feedVisitor);
    await verifyD1GamesReads(db, request, feedOwner, feedVisitor);
    await verifyD1SocialFeatures(db, request, feedOwner, feedVisitor);
    await verifyD1Experience(db, request, feedOwner, feedVisitor);
    await verifyD1Highlights(db, request, feedOwner, feedVisitor);
    await verifyD1Wishlist(db, request, feedOwner, feedVisitor);
    await verifyD1Missions(db, request, feedOwner, feedVisitor);
    await verifyD1BattlePass(db, request, feedOwner, feedVisitor);
    await verifyD1Referrals(db, request, feedOwner, feedVisitor);
    await verifyD1Subscriptions(db, request, feedOwner, feedVisitor);
    await verifyD1DirectGifts(db, request, feedOwner, feedVisitor);
    await verifyD1Events(db, request, feedOwner, feedVisitor);
    await verifyD1Dating(db, request, feedOwner, feedVisitor);
    await verifyD1Vibe(db, request, feedOwner, feedVisitor);
    await verifyD1Groups(db, request, feedOwner, feedVisitor, returning);
    await verifyD1Stories(db, request, returning, feedVisitor, chatHost);
    await verifyD1Moderation(db, request, returning);
    await verifyD1Maintenance(worker, db, returning, visitor);

    // Invalid bodies exercise the rate limits without reaching Firebase or changing sessions.
    async function rateLimitedRequest(path, body, forwardedIp) {
      return worker.dispatchFetch("http://127.0.0.1/api/auth/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": forwardedIp,
          "X-Forwarded-For": forwardedIp,
          "X-Yugm-Client-IP": forwardedIp
        },
        body: JSON.stringify(body)
      });
    }
    for (let i = 0; i < 10; i++) {
      const email = i % 2 ? " Limit@example.test " : "limit@example.test";
      assert.equal((await rateLimitedRequest("google", { email }, "192.0.2." + (i + 1))).status, 422);
    }
    const identifierLimited = await rateLimitedRequest("phone", { email: "LIMIT@example.test" }, "192.0.2.50");
    assert.equal(identifierLimited.status, 429);
    assert.equal(identifierLimited.headers.get("Retry-After"), "60");
    assert.equal((await identifierLimited.json()).error.code, "RATE_LIMITED");

    let clientLimitReached = false;
    for (let i = 1; i <= 21; i++) {
      const result = await rateLimitedRequest("google", { email: `other${i}@example.test` }, "192.0.2." + (50 + i));
      if (result.status === 429) {
        clientLimitReached = true;
        break;
      }
      assert.equal(result.status, 422);
    }
    assert.equal(clientLimitReached, true);

    for (let i = 1; i <= 30; i++) {
      assert.equal((await rateLimitedRequest("refresh", {}, "192.0.2." + i)).status, 422);
    }
    assert.equal((await rateLimitedRequest("refresh", {}, "192.0.2.31")).status, 429);
    assert.equal((await rateLimitedRequest("refresh", { refreshToken: "different" }, "192.0.2.31")).status, 422);
    await verifyD1PushDelivery(worker, db, returning, visitor, pushAttempts);
  } finally {
    await worker?.dispose();
    await legacyWorker?.dispose();
    const resolved = await realpath(directory);
    if (dirname(resolved) === temporaryRoot && basename(resolved).startsWith("yugm-auth-worker-")) {
      await rm(resolved, { recursive: true, force: true });
    }
  }
});
