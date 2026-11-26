import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";
import { vipCycleNotice } from "../../api/src/services/vip.js";
import { rollExpiredVipCycles } from "../../api/src/migration/d1Maintenance.js";

const here = dirname(fileURLToPath(import.meta.url));
const BINDING = "DB";
const now = new Date("2026-11-26T00:00:00.000Z");

async function insertUser(db: any, overrides: Record<string, unknown>) {
  const { results: columns } = await db.prepare('PRAGMA table_info("users")').all();
  const values: Record<string, unknown> = {};
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
  await db.prepare(`INSERT INTO users (${names.map(name => `"${name}"`).join(", ")})
    VALUES (${names.map(() => "?").join(", ")})`).bind(...names.map(name => values[name])).run();
}

test("vipCycleNotice only reports actual tier changes", () => {
  assert.equal(vipCycleNotice(2, 2), null);
  assert.equal(vipCycleNotice(2, 1)?.title, "VIP tier updated");
  assert.equal(vipCycleNotice(2, 0)?.title, "VIP membership ended");
  assert.deepEqual(vipCycleNotice(2, 1)?.data, { type: "VIP_CYCLE", fromLevel: 2, toLevel: 1 });
});

test("VIP cycle review persists the tier change and notifies only changed members", async () => {
  const miniflare = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    compatibilityDate: "2026-11-24",
    d1Databases: { [BINDING]: "test-vip-cycle-notifications" }
  }));
  try {
    const db = await miniflare.getD1Database(BINDING);
    const schema = await readFile(join(here, "../../api/migrations/d1/0001_initial.sql"), "utf8");
    await db.batch(unstable_splitSqlQuery(schema).map(sql => db.prepare(sql)));
    const expired = "2026-08-01T00:00:00.000Z";
    const base = { role: "USER", vip_chat_privacy: "EVERYONE", vip_tier: "VIP2", vip_level: 2,
      vip_expires_at: expired, vip_started_at: "2026-05-01T00:00:00.000Z" };
    await insertUser(db, { ...base, source_id: "vip-downgrade", username: "vip-downgrade", vip_exp: 1200 });
    await insertUser(db, { ...base, source_id: "vip-ended", username: "vip-ended", vip_exp: 500 });
    await insertUser(db, { ...base, source_id: "vip-maintained", username: "vip-maintained", vip_exp: 3000 });

    assert.equal(await rollExpiredVipCycles(db, now), 3);

    const users = await db.prepare("SELECT source_id, vip_tier, vip_level FROM users ORDER BY source_id").all();
    const byId = new Map(users.results.map(row => [row.source_id, row]));
    assert.deepEqual([byId.get("vip-downgrade")?.vip_tier, byId.get("vip-downgrade")?.vip_level], ["VIP1", 1]);
    assert.deepEqual([byId.get("vip-ended")?.vip_tier, byId.get("vip-ended")?.vip_level], [null, 0]);
    assert.deepEqual([byId.get("vip-maintained")?.vip_tier, byId.get("vip-maintained")?.vip_level], ["VIP2", 2]);

    const notices = await db.prepare("SELECT user_id, title, data FROM notifications ORDER BY user_id").all();
    assert.deepEqual(notices.results.map(row => [row.user_id, row.title]), [
      ["vip-downgrade", "VIP tier updated"],
      ["vip-ended", "VIP membership ended"]
    ]);
    assert.deepEqual(JSON.parse(String(notices.results[0].data)), { type: "VIP_CYCLE", fromLevel: 2, toLevel: 1 });
    assert.equal(notices.results.length, 2);
  } finally {
    await miniflare.dispose();
  }
});
