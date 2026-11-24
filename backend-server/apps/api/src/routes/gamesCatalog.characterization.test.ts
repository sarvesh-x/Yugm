import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import { miniGames } from "@yugm/shared";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler";
import { readD1GameCatalog } from "../migration/d1GameCatalog.js";
import { D1TargetWriter } from "../migration/d1Target.js";
import { applyMapping } from "../migration/mappings.js";
import { stableStringify } from "../migration/snapshot.js";
import { TransformContext } from "../migration/transform.js";

async function requestCatalog(app: Express, accessToken: string) {
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/api/games/catalog`;
    const unsigned = await fetch(url);
    assert.equal(unsigned.status, 401);
    const unauthorized = await unsigned.json() as { ok: boolean; error: { code: string; message: string } };
    assert.equal(unauthorized.ok, false);
    assert.equal(unauthorized.error.code, "UNAUTHORIZED");
    assert.equal(unauthorized.error.message, "Missing auth token");

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    assert.equal(response.status, 200);
    return await response.json();
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
}

test("GET /api/games/catalog returns the same contract using MongoDB and the local D1 binding", async (t) => {
  const database = await MongoMemoryServer.create();
  t.after(() => database.stop().then(() => undefined));
  const uri = database.getUri("yugm-games-catalog-characterization");
  const jwtSecret = "local-games-catalog-test-secret";
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = "yugm-games-catalog-characterization";
  process.env.REDIS_URL = "";
  process.env.STORAGE_DRIVER = "mongodb";
  process.env.JWT_SECRET = jwtSecret;

  const [{ createApp }, { User }, { AuthSession }, { MiniGameScore }] = await Promise.all([
    import("../app.js"),
    import("../models/User.js"),
    import("../models/AuthSession.js"),
    import("../models/MiniGameScore.js")
  ]);
  await mongoose.connect(uri);

  try {
    const [player, other] = await User.create([
      { name: "Catalog Player", username: "catalog_player" },
      { name: "Other Player", username: "catalog_other" }
    ]);
    const session = await AuthSession.create({
      userId: player._id,
      familyId: "catalog-family",
      refreshHash: "catalog-test-session",
      tokenVersion: player.tokenVersion,
      expiresAt: new Date(Date.now() + 60_000)
    });
    const accessToken = jwt.sign({
      sub: player.id, sid: session.id, typ: "access", tokenVersion: player.tokenVersion
    }, jwtSecret, { expiresIn: "1m" });

    const firstBest = new Date("2026-01-01T00:00:00.000Z");
    const scores = await MiniGameScore.insertMany(Array.from({ length: 11 }, (_, index) => ({
      userId: player._id,
      gameId: index === 10 ? "memory_match" : "vibe_tap",
      score: index < 2 ? 900 : index,
      metadata: index === 10 ? { streak: 4 } : {},
      createdAt: new Date(firstBest.getTime() + index * 1000)
    })));
    await MiniGameScore.insertMany(Array.from({ length: 256 }, (_, index) => ({
      userId: other._id, gameId: "vibe_tap", score: 9999 + index
    })));
    await MiniGameScore.collection.updateOne({ _id: scores[10]._id }, { $unset: { __v: "" } });
    await MiniGameScore.collection.updateOne({ _id: scores[9]._id }, {
      $set: { durationMs: 0, metadata: null, __v: 3, legacyFlag: true }
    });
    await MiniGameScore.collection.updateOne({ _id: scores[8]._id }, { $set: { rounds: null, metadata: {} } });

    const before = await MiniGameScore.find().sort({ _id: 1 }).lean();
    const baseline = await requestCatalog(createApp(), accessToken);
    const recent = scores.slice(1).reverse().map((score, index) => ({
      _id: score.id,
      userId: player.id,
      gameId: index === 0 ? "memory_match" : "vibe_tap",
      score: index === 9 ? 900 : 10 - index,
      createdAt: new Date(firstBest.getTime() + (10 - index) * 1000).toISOString(),
      ...(index > 0 && { __v: 0 }),
      ...(index === 0 && { metadata: { streak: 4 } }),
      ...(index === 1 && { durationMs: 0, metadata: null, __v: 3, legacyFlag: true }),
      ...(index === 2 && { rounds: null, metadata: {} })
    }));
    assert.deepEqual(baseline, {
      ok: true,
      data: {
        games: [
          { ...miniGames[0], best: { score: 900, createdAt: firstBest.toISOString() } },
          { ...miniGames[1], best: { score: 10, createdAt: "2026-01-01T00:00:10.000Z" } },
          { ...miniGames[2], best: null }
        ],
        recent
      }
    });

    const directory = await mkdtemp(join(tmpdir(), "yugm-catalog-d1-"));
    const configPath = join(directory, "wrangler.jsonc");
    await writeFile(configPath, JSON.stringify({
      name: "yugm-catalog-d1-test",
      compatibility_date: "2026-08-04",
      d1_databases: [{
        binding: "DB", database_name: "catalog-fixture", database_id: "00000000-0000-4000-8000-000000000001"
      }]
    }));
    t.after(async () => {
      await unlink(configPath);
      await rmdir(directory);
    });
    const platform = await getPlatformProxy<{ DB: D1Database }>({
      configPath, envFiles: [], remoteBindings: false, persist: false
    });
    try {
      const db = platform.env.DB;
      const ddl = await readFile(new URL("../../migrations/d1/0001_initial.sql", import.meta.url), "utf8");
      await db.batch(unstable_splitSqlQuery(ddl).map((sql) => db.prepare(sql)));
      const writer = new D1TargetWriter(db);
      const context = new TransformContext("catalog-fixture");
      const players = await User.find().lean();
      for (const [collection, records] of [["users", players], ["mini_game_scores", before]] as const) {
        const writes = records.flatMap((record) => {
          const result = applyMapping(collection, JSON.parse(stableStringify(record)), context);
          assert.equal(result.rejected, false);
          return result.writes;
        });
        await writer.writeBatch(writes);
      }
      context.assertAccountedFor();
      assert.deepEqual(context.quarantine, []);

      const scoreRows = await db.prepare("SELECT * FROM mini_game_scores ORDER BY source_id").all();
      let usage: Awaited<ReturnType<typeof readD1GameCatalog>>["usage"] | undefined;
      const migrated = createApp({
        async readGameCatalogScores(userId) {
          const catalog = await readD1GameCatalog(db, userId);
          usage = catalog.usage;
          return catalog.scores;
        }
      });
      assert.deepEqual(await requestCatalog(migrated, accessToken), baseline);
      assert.ok(usage);
      assert.equal(usage.rowsWritten, 0);
      assert.ok(usage.bestScoresRowsRead + usage.recentScoresRowsRead < before.length);
      assert.ok(usage.databaseBytes > 0);
      t.diagnostic(JSON.stringify({ fixtureScores: before.length, ...usage }));
      const after = await db.prepare("SELECT * FROM mini_game_scores ORDER BY source_id").all();
      assert.deepEqual(after.results, scoreRows.results);
      assert.deepEqual(await MiniGameScore.find().sort({ _id: 1 }).lean(), before);
    } finally {
      await platform.dispose();
    }
  } finally {
    await mongoose.disconnect();
  }
});
