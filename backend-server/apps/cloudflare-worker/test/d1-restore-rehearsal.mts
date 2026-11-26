/**
 * Fixture-only local restore rehearsal.
 *
 * Applies the D1 schema to an ephemeral Miniflare database, imports a checked-in
 * synthetic snapshot through the real mapped importer with persisted checkpoints,
 * reads authoritative rows back, then replays the import to prove idempotency.
 * It refuses remote bindings and never connects to MongoDB, R2, Cloudflare or
 * any live provider. A passing run is evidence for the local fixture only.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";
import { D1TargetWriter } from "../../api/src/migration/d1Target.js";
import { importMappedCollection } from "../../api/src/migration/import.js";
import { FileSystemSnapshotStore, readSnapshotManifest } from "../../api/src/migration/snapshot.js";
import type { Checkpoint, CheckpointStore } from "../../api/src/migration/types.js";
import { verifyBackup } from "../../api/src/migration/verifyBackup.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fromHere = (relative: string) => path.resolve(here, relative);
const LOCAL_D1_ID = "00000000-0000-4000-8000-000000000004";
const FIXTURE_USER_ID = "650000000000000000000001";
const COLLECTIONS = ["users", "wallet_transactions", "media_objects"] as const;

class FileSystemCheckpointStore implements CheckpointStore {
  constructor(private readonly directory: string) {}

  private fileFor(key: string) {
    // Keys are fixture-controlled, but never use them as raw file names.
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120);
    return path.join(this.directory, `${safe}.json`);
  }

  async load(key: string): Promise<Checkpoint | undefined> {
    try {
      return JSON.parse(await readFile(this.fileFor(key), "utf8")) as Checkpoint;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(key: string, checkpoint: Checkpoint): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.fileFor(key), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  }
}

function assertLocalOnlyBindings(config: { d1_databases?: Array<{ binding: string; database_id: string; remote?: boolean }>; r2_buckets?: Array<{ binding: string; remote?: boolean }> }) {
  for (const binding of config.d1_databases ?? []) {
    assert.notEqual(binding.remote, true, `Refusing remote D1 binding ${binding.binding}`);
    assert.equal(binding.database_id, LOCAL_D1_ID, `Refusing non-fixture D1 binding ${binding.binding}`);
  }
  for (const binding of config.r2_buckets ?? []) {
    assert.notEqual(binding.remote, true, `Refusing remote R2 binding ${binding.binding}`);
  }
}

const migrationNames = [
  "0003_direct_message_indexes", "0004_direct_message_writes", "0005_clan_chat_indexes",
  "0006_scheduled_maintenance", "0007_notification_push_jobs", "0008_wallet_purchase_indexes",
  "0009_app_config_key_unique", "0010_support_ticket_sender", "0011_room_poll_indexes",
  "0012_room_invite_index", "0013_room_activity_indexes", "0014_room_message_progression",
  "0015_room_mode_state", "0016_pk_room_history_indexes", "0017_report_review_indexes",
  "0018_gift_catalog_indexes", "0019_room_gift_transfers", "0020_wishlist_unique",
  "0021_user_mission_unique", "0022_referral_unique", "0023_subscription_unique",
  "0024_event_participants_unique", "0025_dating_swipes", "0026_vibe_graph_unique",
  "0027_group_participants_unique", "0028_story_views_unique", "0029_social_unique",
  "0030_experience_claim_unique", "0031_admin_account_indexes", "0032_asset_registry_indexes",
  "0033_report_admin_reviewer", "0034_admin_purchase_refunds", "0035_direct_message_reaction_catalog",
  "0036_deletion_cleanup", "0037_pk_battle_status_check", "0038_pk_uniqueness",
  "0039_gift_inventory_unique", "0040_creator_trust_withdrawal_unique", "0041_friend_match_indexes"
];

test("fixture-only D1 restore replay is idempotent and reconciles with local D1", async () => {
  const localConfig = JSON.parse(await readFile(fromHere("../auth-local/wrangler.jsonc"), "utf8"));
  const productionConfig = JSON.parse(await readFile(fromHere("../wrangler.production.jsonc"), "utf8"));
  assertLocalOnlyBindings(localConfig);
  assert.throws(() => assertLocalOnlyBindings(productionConfig), /non-fixture D1 binding/);

  const snapshotDirectory = fromHere("fixtures/d1-restore");
  const manifest = await readSnapshotManifest(snapshotDirectory);
  assert.equal(manifest.sourceDatabase, "fixture-only");
  assert.equal((await verifyBackup(snapshotDirectory)).passed, true);
  assert.deepEqual(manifest.collections.map((entry) => entry.name), [...COLLECTIONS]);

  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(temporaryRoot, "yugm-restore-rehearsal-"));
  let worker: Miniflare | undefined;
  try {
    const scriptPath = path.join(directory, "fixture-worker.mjs");
    await writeFile(scriptPath, "export default { async fetch() { return new Response('fixture-only'); } };\n", "utf8");
    worker = new Miniflare(convertV4MiniflareOptions({
      modulesRoot: directory,
      modules: [{ type: "ESModule", path: scriptPath }],
      compatibilityDate: localConfig.compatibility_date,
      d1Databases: { AUTH_DB: LOCAL_D1_ID }
    }));
    const db = await worker.getD1Database("AUTH_DB");
    const schemaFiles = ["0001_initial", "0002_reference_catalogs", ...migrationNames];
    for (const name of schemaFiles) {
      const sql = await readFile(fromHere(`../../api/migrations/d1/${name}.sql`), "utf8");
      await db.batch(unstable_splitSqlQuery(sql).map((statement) => db.prepare(statement)));
    }

    const checkpointDirectory = path.join(directory, "checkpoints");
    const source = new FileSystemSnapshotStore(snapshotDirectory);
    const target = new D1TargetWriter(db);
    const checkpoints = new FileSystemCheckpointStore(checkpointDirectory);
    const importOnce = async () => {
      const results = [];
      for (const collection of COLLECTIONS) {
        const result = await importMappedCollection({ snapshot: manifest, collection, source, target, checkpoints, dryRun: false });
        assert.equal(result.quarantined, 0, `${collection} quarantined rows`);
        assert.equal(result.batchesApplied, 1, `${collection} first-pass batch`);
        assert.equal(result.checkpointStatus, "complete", `${collection} checkpoint`);
        results.push(result);
      }
      return results;
    };

    const first = await importOnce();
    assert.equal(first.length, COLLECTIONS.length);
    assert.equal((await readdir(checkpointDirectory)).length, COLLECTIONS.length);

    const user = await db.prepare("SELECT wallet_balance, diamond_balance FROM users WHERE source_id = ?")
      .bind(FIXTURE_USER_ID).first<{ wallet_balance: number; diamond_balance: number }>();
    assert.deepEqual(user, { wallet_balance: 500, diamond_balance: 25 });
    const ledger = await db.prepare("SELECT amount, balance_after, metadata FROM wallet_transactions WHERE user_id = ?")
      .bind(FIXTURE_USER_ID).first<{ amount: number; balance_after: number; metadata: string }>();
    assert.equal(ledger?.amount, 500);
    assert.equal(ledger?.balance_after, user?.wallet_balance);
    assert.equal(JSON.parse(String(ledger?.metadata)).idempotencyKey, "restore-fixture-1");
    const media = await db.prepare("SELECT owner_id, bucket, storage_key FROM media_objects WHERE source_id = ?")
      .bind("restore-fixture-media-1").first<{ owner_id: string; bucket: string; storage_key: string }>();
    assert.equal(media?.owner_id, FIXTURE_USER_ID);
    assert.equal(media?.bucket, "public-media");
    assert.equal(media?.storage_key, "avatars/restore-fixture/full.webp");

    for (const collection of COLLECTIONS) {
      const replay = await importMappedCollection({ snapshot: manifest, collection, source, target, checkpoints, dryRun: false });
      assert.equal(replay.batchesApplied, 0, `${collection} replay must skip the committed batch`);
      assert.equal(replay.batchesSkipped, 1, `${collection} replay skipped batch`);
      assert.equal(replay.processed, 1, `${collection} replay still reads the snapshot`);
    }
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM users WHERE source_id = ?")
      .bind(FIXTURE_USER_ID).first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM wallet_transactions WHERE user_id = ?")
      .bind(FIXTURE_USER_ID).first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM media_objects WHERE source_id = ?")
      .bind("restore-fixture-media-1").first("count"), 1);
  } finally {
    await worker?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
