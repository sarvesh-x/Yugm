/**
 * Opt-in end-to-end test for the read-only snapshot export CLI.
 *
 * Starts a disposable loopback MongoDB, seeds two collections (one with string
 * _id values), runs `snapshot:export` as a child process with env overrides, and
 * asserts the emitted manifest and batch files. It never touches a real database
 * or reads the application's .env values into output.
 *
 * Run with: npm run test:export --workspace @yugm/api
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const server = await MongoMemoryServer.create({ binary: { version: "8.2.6" } });
const uri = server.getUri();
const dbName = "YugmExportTest";
const out = await mkdtemp(path.join(tmpdir(), "yugm-export-e2e-"));

try {
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;
  assert.ok(db, "disposable MongoDB has no database handle");
  await db.collection("users").insertMany([
    { name: "Synthetic One", xp: 10 },
    { name: "Synthetic Two", xp: 20 },
    { name: "Synthetic Three", xp: 30 },
  ]);
  await db.collection("media_objects").insertMany([
    { _id: "media-1", key: "a" },
    { _id: "media-2", key: "b" },
  ]);
  await mongoose.disconnect();

  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : "npm.cmd";
  const args = [
    ...(npmCli ? [npmCli] : []),
    "run", "snapshot:export", "--",
    "--out", out,
    "--confirm-isolated-export", "test",
    "--collections", "users,media_objects",
  ];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: !npmCli,
    env: { ...process.env, MONGODB_URI: uri, MONGODB_DB_NAME: dbName },
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  assert.equal(result.status, 0, "snapshot:export should exit 0");

  const manifest = JSON.parse(await readFile(path.join(out, "snapshot-manifest.json"), "utf8"));
  const byName = new Map(manifest.collections.map((collection) => [collection.name, collection]));
  assert.equal(byName.get("users")?.count, 3);
  assert.equal(byName.get("media_objects")?.count, 2);

  const usersBatch = await readFile(path.join(out, "users-000000.jsonl"), "utf8");
  assert.equal(usersBatch.trim().split("\n").length, 3);
  const mediaBatch = await readFile(path.join(out, "media_objects-000000.jsonl"), "utf8");
  assert.ok(mediaBatch.includes("media-1"));

  console.log("snapshot export end-to-end: PASS (users=3, media_objects=2)");
} finally {
  await mongoose.disconnect().catch(() => undefined);
  await server.stop();
  await rm(out, { recursive: true, force: true });
}
