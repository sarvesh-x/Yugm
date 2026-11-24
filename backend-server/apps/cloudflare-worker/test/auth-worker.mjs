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

const run = promisify(execFile);
const pathFromHere = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const project = "yugm-auth-workerd-fixture";
const keyId = "fixture-firebase-key";
const keysUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const hash = (token) => createHash("sha256").update(token).digest("hex");

test("isolated Worker serves Auth and Profile with just a local D1 binding", async () => {
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
    assert.deepEqual(Object.keys(bundle.inputs).filter(path => /(?:^|[/\\])(?:sharp[/\\]|imageProcessor\.node\.ts$)/.test(path)), []);
    const config = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(config.workers_dev, false);
    assert.equal(config.preview_urls, false);
    const [binding] = config.d1_databases;
    assert.equal(config.d1_databases.length, 1);
    assert.equal(binding.remote, false);
    assert.equal(config.r2_buckets.length, 5);
    assert.deepEqual(config.r2_buckets.map(({ bucket_name: name }) => name),
      ["assets", "public-media", "private-media", "originals", "staging"]);
    assert.ok(config.r2_buckets.every(({ remote }) => remote === false));
    assert.equal(config.images.binding, "IMAGES");
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const signingCert = publicKey.export({ type: "spki", format: "pem" });
    let certificateRequests = 0;
    worker = new Miniflare(convertV4MiniflareOptions({
      modulesRoot: directory,
      modules: [{ type: "ESModule", path: join(directory, "authLocal.js") }],
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      bindings: { ...config.vars, FCM_PROJECT_ID: project, JWT_SECRET: randomBytes(32).toString("hex") },
      d1Databases: { [binding.binding]: binding.database_id },
      r2Buckets: Object.fromEntries(config.r2_buckets.map(({ binding: name, bucket_name: bucket }) => [name, bucket])),
      images: { binding: config.images.binding },
      cf: false,
      outboundService(request) {
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
      assert.equal(response.status, status, `${path} returned ${response.status}: ${result}`);
      return JSON.parse(result);
    }

    assert.equal((await request("/health", 200)).ok, true);
    const emulatorHealth = await worker.dispatchFetch("http://10.0.2.2/health");
    assert.equal(emulatorHealth.status, 200);
    assert.equal((await emulatorHealth.json()).ok, true);
    assert.equal((await request("/ready", 503)).ok, false);
    const db = await worker.getD1Database(binding.binding);
    const schema = await readFile(pathFromHere("../../api/migrations/d1/0001_initial.sql"), "utf8");
    await db.batch(unstable_splitSqlQuery(schema).map((sql) => db.prepare(sql)));
    assert.equal((await request("/ready", 200)).storage, "d1");
    assert.equal((await worker.dispatchFetch("http://yugm.example/health")).status, 404);
    await request("/api/users", 404);

    legacyWorker = new Miniflare(convertV4MiniflareOptions({
      modulesRoot: directory,
      modules: [{ type: "ESModule", path: join(directory, "authLocal.js") }],
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      bindings: {
        ...config.vars, FCM_PROJECT_ID: project, JWT_SECRET: randomBytes(32).toString("hex"),
        MONGODB_URI: "mongodb://127.0.0.1:27017"
      },
      d1Databases: { [binding.binding]: binding.database_id },
      cf: false
    }));
    const legacyReady = await legacyWorker.dispatchFetch("http://127.0.0.1/ready");
    assert.equal(legacyReady.status, 503);
    assert.match(await legacyReady.text(), /isolated D1 configuration/);

    function signIn(emailVerified, audience = project, status = 200, account = "worker-fixture-uid") {
      const idToken = jwt.sign({
        email: `${account}@example.test`,
        email_verified: emailVerified,
        auth_time: Math.floor(Date.now() / 1000),
        firebase: { sign_in_provider: "password" }
      }, privateKey, {
        algorithm: "RS256", keyid: keyId, issuer: `https://securetoken.google.com/${project}`,
        audience, subject: account, expiresIn: "5m"
      });
      return request("/api/auth/google", status, { body: { idToken, acceptTerms: true, provider: "email" } });
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

    const { data: returning } = await signIn(true);
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
  } finally {
    await worker?.dispose();
    await legacyWorker?.dispose();
    const resolved = await realpath(directory);
    if (dirname(resolved) === temporaryRoot && basename(resolved).startsWith("yugm-auth-worker-")) {
      await rm(resolved, { recursive: true, force: true });
    }
  }
});
