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
    assert.equal((await request("/ready", 503)).ok, false);
    const db = await worker.getD1Database(binding.binding);
    const schema = await readFile(pathFromHere("../../api/migrations/d1/0001_initial.sql"), "utf8");
    await db.batch(unstable_splitSqlQuery(schema).map((sql) => db.prepare(sql)));
    assert.equal((await request("/ready", 200)).storage, "d1");
    assert.equal((await worker.dispatchFetch("http://yugm.example/health")).status, 404);
    await request("/api/users", 404);

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
    const details = {
      name: "  Worker Fixture  ", username: " WORKER_UPDATED ", age: 23, gender: "Female", bio: " A profile ", city: "Pune",
      lookingFor: "Friendship", languages: ["English", " english "], interests: [" Music ", "Art"], acceptTerms: true,
      walletBalance: 99999
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
    }
    assert.equal((await request("/api/users/me", 200, returning)).data.user.xp, 170);
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
  } finally {
    await worker?.dispose();
    const resolved = await realpath(directory);
    if (dirname(resolved) === temporaryRoot && basename(resolved).startsWith("yugm-auth-worker-")) {
      await rm(resolved, { recursive: true, force: true });
    }
  }
});
