import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";
import jwt from "jsonwebtoken";

const run = promisify(execFile);
const pathFromHere = relative => fileURLToPath(new URL(relative, import.meta.url));

test("the production entrypoint uses D1 and configures hosted R2 with a media pause switch", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "yugm-production-worker-"));
  const configPath = pathFromHere("../wrangler.production.jsonc");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(config.main, "src/production.ts");
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.vars.YUGM_R2_ENABLED, "true");
  assert.equal(config.vars.APP_CHECK_ENFORCE, "true");
  assert.deepEqual(config.triggers.crons, ["*/15 * * * *", "* * * * *"]);
  assert.deepEqual(config.durable_objects.bindings, [{ name: "PK_DEADLINES", class_name: "D1PkAlarm" }]);
  assert.ok(config.migrations.some(({ new_sqlite_classes: classes }) => classes?.includes("D1PkAlarm")));
  assert.ok(!("MONGODB_DB_NAME" in config.vars));
  assert.equal(config.d1_databases.length, 1);
  const [binding] = config.d1_databases;
  assert.equal(binding.database_name, "yugm");
  assert.equal(binding.database_id, "07d88439-c0ca-4e13-bfc9-b08d7bcdb371");
  const localConfig = JSON.parse(await readFile(pathFromHere("../auth-local/wrangler.jsonc"), "utf8"));
  assert.equal(localConfig.d1_databases[0].database_name, binding.database_name);
  assert.notEqual(localConfig.d1_databases[0].database_id, binding.database_id);
  assert.deepEqual(config.ratelimits.map(({ name, simple }) => [name, simple.limit, simple.period]), [
    ["AUTH_REQUESTS", 20, 60], ["AUTH_IDENTIFIER", 10, 60], ["AUTH_REFRESH", 30, 60], ["CHAT_SEND", 12, 10],
    ["REPORT_REQUESTS", 5, 60], ["CREATE_REQUESTS", 10, 60], ["GIFT_SEND", 20, 10]
  ]);
  assert.equal(new Set([...config.ratelimits, ...localConfig.ratelimits].map(({ namespace_id }) => namespace_id)).size, 14);
  assert.deepEqual(Object.fromEntries(config.r2_buckets.map(({ binding, bucket_name }) => [binding, bucket_name])), {
    ASSETS: "yugm-assets", PUBLIC_MEDIA: "yugm-public-media", PRIVATE_MEDIA: "yugm-private-media",
    ORIGINALS: "yugm-originals", STAGING: "yugm-staging"
  });

  const workers = [];
  try {
    await run(process.execPath, [pathFromHere("../../../node_modules/wrangler/bin/wrangler.js"),
      "deploy", "--dry-run", "--config", configPath, "--outdir", directory, "--metafile"], {
      cwd: pathFromHere("../"), env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, windowsHide: true
    });
    const bundle = JSON.parse(await readFile(join(directory, "bundle-meta.json"), "utf8"));
    assert.deepEqual(Object.keys(bundle.inputs).filter(path =>
      /(?:^|[/\\])(?:sharp[/\\]|imageProcessor\.node\.ts$|runtime\.ts$|livekit-server-sdk[/\\]|mongoose[/\\]|mongodb[/\\]|bson[/\\]|ioredis[/\\]|bullmq[/\\]|redis-adapter[/\\]|redis\.ts$)/.test(path)), []);

    function makeWorker(bindings, outboundService = () => { throw new Error("Unexpected external request in the production fixture"); }) {
      const worker = new Miniflare(convertV4MiniflareOptions({
        modulesRoot: directory,
        modules: [{ type: "ESModule", path: join(directory, "production.js") }],
        compatibilityDate: config.compatibility_date,
        compatibilityFlags: config.compatibility_flags,
        bindings: { ...config.vars, ...bindings },
        d1Databases: { [binding.binding]: binding.database_id },
        durableObjects: { PK_DEADLINES: { className: "D1PkAlarm", useSQLite: true } },
        ratelimits: Object.fromEntries(config.ratelimits.map(({ name, ...settings }) => [name, settings])),
        r2Buckets: Object.fromEntries(config.r2_buckets.map(({ binding, bucket_name }) => [binding, bucket_name])),
        images: { binding: "IMAGES" },
        cf: false,
        outboundService
      }));
      workers.push(worker);
      return worker;
    }

    const origin = "https://api.yugm.test";
    const placeholder = makeWorker({});
    assert.equal((await placeholder.dispatchFetch(config.vars.YUGM_PRODUCTION_ORIGIN + "/health")).status, 404);
    const missingSecrets = makeWorker({ YUGM_PRODUCTION_ORIGIN: origin });
    assert.equal((await missingSecrets.dispatchFetch(origin + "/api/health")).status, 200);
    assert.equal((await missingSecrets.dispatchFetch(origin + "/ready")).status, 503);

    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const firebaseFixture = {
      YUGM_PRODUCTION_ORIGIN: origin,
      JWT_SECRET: randomBytes(32).toString("hex"),
      FCM_PROJECT_ID: "yugm-production-fixture",
      FCM_CLIENT_EMAIL: "firebase-fixture@yugm-production-fixture.iam.gserviceaccount.com",
      FCM_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" })
    };
    const adminFirebaseUid = "production-admin-fixture";
    const adminEmail = "fixture@example.test";
    const hostedPassword = "production-fixture-password";
    const token = jwt.sign({ auth_time: Math.floor(Date.now() / 1000), email: adminEmail,
      firebase: { sign_in_provider: "password" } }, privateKey, {
      algorithm: "RS256", keyid: "fixture-key", subject: adminFirebaseUid, audience: firebaseFixture.FCM_PROJECT_ID,
      issuer: `https://securetoken.google.com/${firebaseFixture.FCM_PROJECT_ID}`, expiresIn: "15m"
    });
    const worker = makeWorker({
      ...firebaseFixture, YUGM_R2_ENABLED: "false", ADMIN_FIREBASE_WEB_API_KEY: "fixture-key",
      ADMIN_REFRESH_SECRET: randomBytes(32).toString("hex"), ADMIN_PANEL_ORIGIN: "https://admin.yugm.test"
    }, async req => {
      if (req.url === "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fixture-key") {
        const body = await req.json();
        if (body.email !== adminEmail || body.password !== hostedPassword) {
          return Response.json({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }, { status: 400 });
        }
        return Response.json({ idToken: token });
      }
      if (req.url === "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com") {
        return Response.json({ "fixture-key": publicKey.export({ type: "spki", format: "pem" }) }, {
          headers: { "cache-control": "max-age=300" }
        });
      }
      throw new Error("Unexpected external request in the production fixture");
    });
    assert.equal((await worker.dispatchFetch("http://127.0.0.1/health")).status, 404);
    assert.equal((await worker.dispatchFetch("https://unrelated.test/health")).status, 404);
    assert.equal((await worker.dispatchFetch(origin + "/ready")).status, 503);

    const db = await worker.getD1Database(binding.binding);
    const migrationDir = pathFromHere("../../api/migrations/d1/");
    const migrations = (await readdir(migrationDir)).filter(file => /^\d{4}_.+\.sql$/.test(file)).sort();
    const schema = await Promise.all(migrations.map(file => readFile(join(migrationDir, file), "utf8")));
    async function applyMigrations(database) {
      for (const migration of schema) await database.batch(unstable_splitSqlQuery(migration).map(sql => database.prepare(sql)));
    }
    await applyMigrations(db);
    const readiness = await worker.dispatchFetch(origin + "/api/ready");
    assert.equal(readiness.status, 200);
    assert.deepEqual(await readiness.json(), { ok: true, service: "yugm-api", storage: "d1", managedMedia: false });
    const themeCatalog = await worker.dispatchFetch(origin + "/api/themes");
    assert.equal(themeCatalog.status, 401);
    assert.equal((await themeCatalog.json()).error.code, "UNAUTHORIZED");
    const contactPage = await worker.dispatchFetch(origin + "/legal/contact");
    assert.equal(contactPage.status, 200);
    assert.match(await contactPage.text(), /\/api\/support\/public-requests/);
    const missingAppCheck = await worker.dispatchFetch(origin + "/api/auth/google", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    assert.equal(missingAppCheck.status, 401);
    assert.match(await missingAppCheck.text(), /App verification token is required/i);
    const missingDeviceAppCheck = await worker.dispatchFetch(origin + "/api/notifications/device-token", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    assert.equal(missingDeviceAppCheck.status, 401);
    assert.match(await missingDeviceAppCheck.text(), /App verification token is required/i);
    assert.equal((await worker.dispatchFetch(origin + "/api/media/uploads", { method: "POST" })).status, 503);
    assert.equal((await worker.dispatchFetch(origin + "/api/assets/published/none/full")).status, 503);

    const adminId = randomBytes(12).toString("hex");
    const sessionId = randomBytes(12).toString("hex");
    await db.batch([
      db.prepare(`INSERT INTO admin_users (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled, firebase_uid)
        VALUES (?, ?, 'Production fixture', 'ADMIN', 'ACTIVE', 0, 0, ?)`).bind(adminId, adminEmail, adminFirebaseUid),
      db.prepare(`INSERT INTO admin_sessions (source_id, admin_id, refresh_token_hash, expires_at)
        VALUES (?, ?, 'fixture', ?)`).bind(sessionId, adminId, new Date(Date.now() + 900_000).toISOString())
    ]);
    const adminToken = jwt.sign({ sub: adminId, sessionId, type: "admin", role: "ADMIN" },
      firebaseFixture.JWT_SECRET, { expiresIn: "15m" });
    const adminPath = origin + "/api/admin";
    const preflight = await worker.dispatchFetch(adminPath + "/auth/login", { method: "OPTIONS", headers: {
      Origin: "https://admin.yugm.test", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"
    } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "https://admin.yugm.test");
    assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /Idempotency-Key/i);
    assert.equal((await worker.dispatchFetch(adminPath + "/auth/login", {
      method: "OPTIONS", headers: { Origin: "https://unrelated.test" }
    })).status, 403);
    assert.equal((await worker.dispatchFetch(adminPath + "/dashboard/overview")).status, 401);
    for (const path of ["/dashboard/overview", "/payments/recharges", "/gifts", "/cosmetics", "/notifications/campaigns"]) {
      const response = await worker.dispatchFetch(adminPath + path, { headers: { Authorization: `Bearer ${adminToken}` } });
      assert.equal(response.status, 200, path);
      assert.equal((await response.json()).success, true);
    }
    const hostedLogin = await worker.dispatchFetch(adminPath + "/auth/login", {
      method: "POST", headers: { "content-type": "application/json", Origin: "https://admin.yugm.test" },
      body: JSON.stringify({ email: adminEmail, password: hostedPassword })
    });
    assert.equal(hostedLogin.status, 200);
    assert.equal(hostedLogin.headers.get("Access-Control-Allow-Origin"), "https://admin.yugm.test");
    const hostedSession = (await hostedLogin.json()).data;
    assert.equal(hostedSession.admin.id, adminId);
    const hostedRefresh = await worker.dispatchFetch(adminPath + "/auth/refresh", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: hostedSession.refreshToken })
    });
    assert.equal(hostedRefresh.status, 200);

    const missingMediaSecret = makeWorker(firebaseFixture);
    assert.equal((await missingMediaSecret.dispatchFetch(origin + "/ready")).status, 503);
    const withMedia = makeWorker({ ...firebaseFixture, MEDIA_GRANT_SECRET: randomBytes(32).toString("hex") });
    const mediaDb = await withMedia.getD1Database(binding.binding);
    await applyMigrations(mediaDb);
    const assetId = randomBytes(12).toString("hex");
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9kAAAAASUVORK5CYII=", "base64");
    const key = "assets/fixture-full.png";
    await mediaDb.batch([
      mediaDb.prepare(`INSERT INTO assets (source_id, owner_type, owner_id, kind, status, version, original_name, mime_type, bytes,
        width, height, sha256, staging_key, staging_url, created_by)
        VALUES (?, 'cosmetic', 'fixture', 'IMAGE', 'published', 1, 'fixture.png', 'image/png', ?, 1, 1, 'fixture',
          'fixture-stage', '', 'fixture')`).bind(assetId, bytes.length),
      mediaDb.prepare(`INSERT INTO asset_variants (source_id, name, key, url, content_type, bytes, assets_id, position)
        VALUES (?, 'full', ?, '', 'image/png', ?, ?, 0)`).bind(assetId + ":full", key, bytes.length, assetId)
    ]);
    const assets = await withMedia.getR2Bucket("ASSETS");
    await assets.put(key, new Uint8Array(bytes));
    const mediaReady = await withMedia.dispatchFetch(origin + "/ready");
    assert.equal(mediaReady.status, 200);
    assert.equal((await mediaReady.json()).managedMedia, true);
    const published = await withMedia.dispatchFetch(origin + "/api/assets/published/" + assetId + "/full");
    assert.equal(published.status, 200);
    assert.equal(published.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await published.arrayBuffer()), bytes);
  } finally {
    await Promise.all(workers.map(worker => worker.dispose()));
    const resolved = await realpath(directory);
    if (dirname(resolved) === temporaryRoot && basename(resolved).startsWith("yugm-production-worker-")) {
      await rm(resolved, { recursive: true, force: true });
    }
  }
});
