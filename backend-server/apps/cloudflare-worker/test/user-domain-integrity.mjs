import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "../../api/migrations/d1");
const BINDING = "DB";

async function applyMigration(db, file) {
  const sql = await readFile(join(migrationsDir, file), "utf8");
  await db.batch(unstable_splitSqlQuery(sql).map(statement => db.prepare(statement)));
}

/** Insert a row with valid placeholders for every required NOT NULL column. */
async function insertRow(db, table, overrides = {}) {
  const { results: columns } = await db.prepare(`PRAGMA table_info("${table}")`).all();
  const values = {};
  for (const column of columns) {
    if (Object.hasOwn(overrides, column.name)) {
      values[column.name] = overrides[column.name];
      continue;
    }
    if (!column.notnull || column.dflt_value !== null || column.pk) continue;
    const type = String(column.type ?? "").toUpperCase();
    values[column.name] = type.includes("INT") ? 0 : "fixture";
  }
  const names = Object.keys(values);
  await db.prepare(`INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(", ")})
    VALUES (${names.map(() => "?").join(", ")})`).bind(...names.map(name => values[name])).run();
}

async function indexInfo(db, table) {
  const { results } = await db.prepare(`PRAGMA index_list("${table}")`).all();
  return new Map(results.map(index => [index.name, index]));
}

test("0042 enforces user-domain uniqueness and adds query indexes", async () => {
  const miniflare = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    compatibilityDate: "2026-11-24",
    d1Databases: { [BINDING]: "test-user-domain-integrity" }
  }));
  try {
    const db = await miniflare.getD1Database(BINDING);
    await applyMigration(db, "0001_initial.sql");
    await insertRow(db, "users", {
      source_id: "user-1", username: "integrity-user", role: "USER", vip_chat_privacy: "EVERYONE"
    });
    const addOwned = (id, value) => db.prepare(`INSERT INTO user_owned_cosmetics
      (source_id, value, users_id, position) VALUES (?, ?, ?, 0)`).bind(id, value, "user-1").run();
    // Seeded before the unique index exists to exercise the migration's dedup step.
    await addOwned("owned-before-1", "cosmetic-duplicate");
    await addOwned("owned-before-2", "cosmetic-duplicate");
    await applyMigration(db, "0042_user_domain_integrity.sql");
    const surviving = await db.prepare("SELECT source_id FROM user_owned_cosmetics WHERE value = 'cosmetic-duplicate'").all();
    assert.equal(surviving.results.length, 1);

    const owned = await indexInfo(db, "user_owned_cosmetics");
    assert.equal(owned.get("idx_user_owned_cosmetics_owner_value")?.unique, 1);
    const bonds = await indexInfo(db, "bonds");
    assert.equal(bonds.get("idx_bonds_active_pair")?.unique, 1);
    assert.ok(bonds.has("idx_bonds_pair_status"));
    const requests = await indexInfo(db, "bond_requests");
    assert.ok(requests.has("idx_bond_requests_status_expires"));
    const points = await indexInfo(db, "bond_points");
    assert.ok(points.has("idx_bond_points_kind_created"));

    await addOwned("owned-1", "cosmetic-1");
    await assert.rejects(() => addOwned("owned-2", "cosmetic-1"), /UNIQUE constraint failed/);
    await addOwned("owned-3", "cosmetic-2");

    const addBond = (id, status) => insertRow(db, "bonds", {
      source_id: id, pair_key: "user-1:user-2", status, activated_at: "2026-01-01T00:00:00.000Z"
    });
    await addBond("bond-1", "ACTIVE");
    await assert.rejects(() => addBond("bond-2", "ACTIVE"), /UNIQUE constraint failed/);
    await addBond("bond-3", "ENDED");
  } finally {
    await miniflare.dispose();
  }
});
