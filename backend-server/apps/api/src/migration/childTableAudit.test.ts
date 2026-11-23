import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildChildTableAudit, loadChildTableAudit } from "./childTableAudit.js";
import { CHILD_TABLES } from "./childTables.js";

const MODEL_TO_TABLE: Record<string, string> = {
  User: "users",
  AdminUser: "admin_users",
  Achievement: "achievements",
  AssetObject: "assets",
  MediaObject: "media_objects",
  BattlePass: "battle_passes",
  Season: "seasons",
  VibeGraph: "vibe_graphs",
  GiftCollection: "gift_collections",
  ClanMessage: "clan_messages",
  DirectMessage: "direct_messages",
  GroupChat: "group_chats",
  Poll: "polls",
  VoicePoll: "voice_polls",
  SupportTicket: "support_tickets",
  Event: "events",
  Story: "stories",
  Bond: "bonds",
  Match: "matches",
  Relationship: "relationships",
  RoomModeState: "room_mode_states",
  BondRankingSnapshot: "bond_ranking_snapshots",
  Clan: "clans",
  Gift: "gifts",
  Room: "rooms",
  StoryHighlight: "story_highlights",
};

test("maps every declared child-table model to a reviewed root collection", () => {
  const report = buildChildTableAudit(MODEL_TO_TABLE);

  assert.deepEqual(report.unmappedModels, []);
  assert.equal(report.impactedRootCount, Object.keys(CHILD_TABLES).length);
  assert.ok(report.childTableCount > report.impactedRootCount);
  const users = report.impacts.find((entry) => entry.model === "User")!;
  assert.equal(users.collection, "users");
  assert.ok(users.childTables.includes("user_interests"));
  assert.deepEqual(
    report.reviewItems.map((item) => item.id),
    ["replacement-unit", "stale-child-rows", "idempotent-replay"]
  );
});

test("reports unmapped models instead of dropping them", () => {
  const report = buildChildTableAudit({ User: "users" }, "partial");

  assert.ok(report.unmappedModels.includes("Room"));
  assert.equal(report.impactedRootCount, 1);
});

test("digest is stable for the same mapping", () => {
  const first = buildChildTableAudit(MODEL_TO_TABLE);
  const second = buildChildTableAudit(MODEL_TO_TABLE);

  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.digest, second.digest);
});

test("loads modelToTable from a local manifest", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-child-table-audit-"));
  const manifest = path.join(directory, "manifest.json");
  try {
    await writeFile(manifest, JSON.stringify({ modelToTable: MODEL_TO_TABLE }), "utf8");
    const report = await loadChildTableAudit(manifest);

    assert.equal(report.source, "manifest.json");
    assert.equal(report.impactedRootCount, Object.keys(CHILD_TABLES).length);

    await writeFile(manifest, JSON.stringify({}), "utf8");
    await assert.rejects(() => loadChildTableAudit(manifest), /missing modelToTable/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
