import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

const run = promisify(execFile);
const pathFromHere = relative => fileURLToPath(new URL(relative, import.meta.url));

test("the production entrypoint uses D1 and keeps hosted media disabled by default", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "yugm-production-worker-"));
  const configPath = pathFromHere("../wrangler.production.jsonc");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(config.main, "src/production.ts");
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.vars.YUGM_R2_ENABLED, "false");
  assert.equal(config.vars.APP_CHECK_ENFORCE, "true");
  assert.equal(config.durable_objects, undefined);
  assert.ok(!("MONGODB_DB_NAME" in config.vars));
  assert.equal(config.d1_databases.length, 1);
  assert.equal(config.r2_buckets.length, 5);

  const workers = [];
  try {
    await run(process.execPath, [pathFromHere("../../../node_modules/wrangler/bin/wrangler.js"),
      "deploy", "--dry-run", "--config", configPath, "--outdir", directory, "--metafile"], {
      cwd: pathFromHere("../"), env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, windowsHide: true
    });
    const bundle = JSON.parse(await readFile(join(directory, "bundle-meta.json"), "utf8"));
    assert.deepEqual(Object.keys(bundle.inputs).filter(path =>
      /(?:^|[/\\])(?:sharp[/\\]|imageProcessor\.node\.ts$|runtime\.ts$|livekit-server-sdk[/\\])/.test(path)), []);

    const [binding] = config.d1_databases;
    function makeWorker(bindings) {
      const worker = new Miniflare(convertV4MiniflareOptions({
        modulesRoot: directory,
        modules: [{ type: "ESModule", path: join(directory, "production.js") }],
        compatibilityDate: config.compatibility_date,
        compatibilityFlags: config.compatibility_flags,
        bindings: { ...config.vars, ...bindings },
        d1Databases: { [binding.binding]: binding.database_id },
        r2Buckets: Object.fromEntries(config.r2_buckets.map(({ binding, bucket_name }) => [binding, bucket_name])),
        images: { binding: "IMAGES" },
        cf: false,
        outboundService() {
          throw new Error("Unexpected external request in the production fixture");
        }
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

    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const firebaseFixture = {
      YUGM_PRODUCTION_ORIGIN: origin,
      JWT_SECRET: randomBytes(32).toString("hex"),
      FCM_PROJECT_ID: "yugm-production-fixture",
      FCM_CLIENT_EMAIL: "firebase-fixture@yugm-production-fixture.iam.gserviceaccount.com",
      FCM_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" })
    };
    const worker = makeWorker(firebaseFixture);
    assert.equal((await worker.dispatchFetch("http://127.0.0.1/health")).status, 404);
    assert.equal((await worker.dispatchFetch("https://unrelated.test/health")).status, 404);
    assert.equal((await worker.dispatchFetch(origin + "/ready")).status, 503);

    const db = await worker.getD1Database(binding.binding);
    const schema = await readFile(pathFromHere("../../api/migrations/d1/0001_initial.sql"), "utf8");
    await db.batch(unstable_splitSqlQuery(schema).map(sql => db.prepare(sql)));
    const readiness = await worker.dispatchFetch(origin + "/api/ready");
    assert.equal(readiness.status, 200);
    assert.deepEqual(await readiness.json(), { ok: true, service: "yugm-api", storage: "d1", managedMedia: false });
    const missingAppCheck = await worker.dispatchFetch(origin + "/api/auth/google", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    assert.equal(missingAppCheck.status, 401);
    assert.match(await missingAppCheck.text(), /App verification token is required/i);
    assert.equal((await worker.dispatchFetch(origin + "/api/media/uploads", { method: "POST" })).status, 503);
    assert.equal((await worker.dispatchFetch(origin + "/api/assets/published/none/full")).status, 503);

    const missingMediaSecret = makeWorker({ ...firebaseFixture, YUGM_R2_ENABLED: "true" });
    assert.equal((await missingMediaSecret.dispatchFetch(origin + "/ready")).status, 503);
    const withMedia = makeWorker({ ...firebaseFixture, YUGM_R2_ENABLED: "true", MEDIA_GRANT_SECRET: randomBytes(32).toString("hex") });
    const mediaDb = await withMedia.getD1Database(binding.binding);
    await mediaDb.batch(unstable_splitSqlQuery(schema).map(sql => mediaDb.prepare(sql)));
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
