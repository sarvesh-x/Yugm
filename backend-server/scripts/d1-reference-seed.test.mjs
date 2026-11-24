import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = name => readFileSync(new URL("../apps/api/migrations/d1/" + name, import.meta.url), "utf8");
const schema = migration("0001_initial.sql");
const seed = migration("0002_reference_catalogs.sql");

test("D1 catalog setup preserves existing records and can be replayed", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(schema);
    db.exec(`INSERT INTO achievements (source_id, id, title, description, category, icon, kind, hidden, "order")
      VALUES ('existing-badge', 'profile_complete', 'Customized badge', '', 'CONTENT', 'sparkles', 'ACHIEVEMENT', 0, 1)`);
    db.exec(seed);
    const counts = `SELECT
      (SELECT COUNT(*) FROM cosmetics) AS cosmetics,
      (SELECT COUNT(*) FROM achievements) AS achievements,
      (SELECT COUNT(*) FROM achievement_tiers) AS tiers,
      (SELECT COUNT(*) FROM gifts) AS gifts`;
    assert.deepEqual({ ...db.prepare(counts).get() }, { cosmetics: 118, achievements: 13, tiers: 32, gifts: 8 });
    assert.equal(db.prepare("SELECT title FROM achievements WHERE id = 'profile_complete'").get().title, "Customized badge");
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM achievement_tiers WHERE achievements_id = 'existing-badge'").get().total, 0);
    const seeded = ["users", "admin_users", "rooms", "wallet_transactions", "assets"].map(table =>
      db.prepare("SELECT COUNT(*) AS total FROM " + table).get().total);
    assert.deepEqual(seeded, [0, 0, 0, 0, 0]);

    db.exec("UPDATE gifts SET limited_edition_remaining = 37 WHERE name = 'Dragon'");
    db.exec("UPDATE cosmetics SET coin_price = 400 WHERE source_id = 'frame_gold'");
    db.exec(seed);
    assert.deepEqual({ ...db.prepare(counts).get() }, { cosmetics: 118, achievements: 13, tiers: 32, gifts: 8 });
    assert.equal(db.prepare("SELECT limited_edition_remaining FROM gifts WHERE name = 'Dragon'").get().limited_edition_remaining, 37);
    assert.equal(db.prepare("SELECT coin_price FROM cosmetics WHERE source_id = 'frame_gold'").get().coin_price, 400);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
