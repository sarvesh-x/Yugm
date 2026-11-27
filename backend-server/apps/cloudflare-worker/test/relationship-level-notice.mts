import assert from "node:assert/strict";
import test from "node:test";
import { prepareRelationship } from "../../api/src/migration/d1RelationshipAward.js";

test("relationship awards announce a relationship level, not a bond level", () => {
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  const write = (sql: string, ...values: unknown[]) => {
    const statement = { sql, values };
    writes.push(statement);
    return statement as never;
  };

  prepareRelationship(
    write, "1 = 1",
    { source_id: "rel-1", xp: 0, level: 1, streak_days: 0, last_streak_at: null, last_interaction_at: null },
    50, ["user-a", "user-b"], new Date("2026-11-26T00:00:00.000Z"),
    "user-a:user-b", "2026-11-26", "relationship_message_xp_daily"
  );

  const notices = writes.filter(entry => entry.sql.includes("INSERT INTO notifications"));
  assert.equal(notices.length, 2);
  for (const notice of notices) {
    assert.ok(notice.values.includes("Relationship level up!"));
    const body = notice.values.find(value => typeof value === "string" && value.startsWith("Your relationship reached"));
    assert.match(String(body), /^Your relationship reached Level 2: .+\.$/);
  }
});
