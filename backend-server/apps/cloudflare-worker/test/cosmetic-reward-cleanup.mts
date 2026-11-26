import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";
import { expireD1BondRewards } from "../../api/src/migration/d1Bonds.js";

const here = dirname(fileURLToPath(import.meta.url));
const BINDING = "DB";
const now = new Date("2026-11-26T00:00:00.000Z");

async function insertRow(db: any, table: string, overrides: Record<string, unknown>) {
  const { results: columns } = await db.prepare(`PRAGMA table_info("${table}")`).all();
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
  await db.prepare(`INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(", ")})
    VALUES (${names.map(() => "?").join(", ")})`).bind(...names.map(name => values[name])).run();
}

test("expired reward-only cosmetics are unequipped from every slot", async () => {
  const miniflare = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    compatibilityDate: "2026-11-24",
    d1Databases: { [BINDING]: "test-cosmetic-reward-cleanup" }
  }));
  try {
    const db = await miniflare.getD1Database(BINDING);
    for (const file of ["0001_initial.sql", "0042_user_domain_integrity.sql"]) {
      const sql = await readFile(join(here, "../../api/migrations/d1", file), "utf8");
      await db.batch(unstable_splitSqlQuery(sql).map(statement => db.prepare(statement)));
    }

    await insertRow(db, "users", {
      source_id: "user-1", username: "reward-user", role: "USER", vip_chat_privacy: "EVERYONE",
      active_cosmetics_avatar_frame: "reward-frame", active_cosmetics_profile_badge: "reward-badge"
    });
    for (const [id, type] of [["reward-frame", "AVATAR_FRAME"], ["reward-badge", "PROFILE_BADGE"]]) {
      await insertRow(db, "cosmetics", {
        source_id: id, type, name: id, coin_price: 0, rarity: "RARE", preview: "",
        is_active: 1, reward_only: 1
      });
    }
    await db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
      VALUES (?, ?, ?, ?)`).bind("owned-frame", "reward-frame", "user-1", 0).run();
    await db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
      VALUES (?, ?, ?, ?)`).bind("owned-badge", "reward-badge", "user-1", 1).run();
    const grant = (id: string, item: string, expires: string) => insertRow(db, "bond_rewards", {
      source_id: id, bond_id: "bond-1", user_id: "user-1", key: id, item_id: item,
      granted_at: "2026-01-01T00:00:00.000Z", expires_at: expires
    });
    await grant("expired-frame", "reward-frame", "2026-02-01T00:00:00.000Z");
    await grant("active-frame", "reward-frame", "2027-01-01T00:00:00.000Z");
    await grant("expired-badge", "reward-badge", "2026-02-01T00:00:00.000Z");

    assert.equal(await expireD1BondRewards(db, now), 2);

    const user = await db.prepare(`SELECT active_cosmetics_avatar_frame AS frame,
      active_cosmetics_profile_badge AS badge FROM users WHERE source_id = 'user-1'`).first();
    // The frame has another active grant; the badge does not.
    assert.equal(user.frame, "reward-frame");
    assert.equal(user.badge, null);
    const owned = await db.prepare("SELECT value FROM user_owned_cosmetics ORDER BY position").all();
    assert.deepEqual(owned.results.map(row => row.value), ["reward-frame"]);
    const rewards = await db.prepare("SELECT source_id, expired_at FROM bond_rewards ORDER BY source_id").all();
    assert.deepEqual(rewards.results.map(row => [row.source_id, row.expired_at]), [
      ["active-frame", null],
      ["expired-badge", now.toISOString()],
      ["expired-frame", now.toISOString()]
    ]);
  } finally {
    await miniflare.dispose();
  }
});
