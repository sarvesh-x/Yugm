import { createHash } from "node:crypto";
import { profileCosmetics } from "@yugm/shared";
import { defaultAchievements } from "../apps/api/src/services/achievementDefinitions.js";
import { baseGifts } from "../apps/api/src/services/giftSeedCatalog.js";

type Value = string | number | boolean | null;

function literal(value: Value): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return "'" + value.replaceAll("'", "''") + "'";
}

function sourceId(catalog: string, key: string) {
  return createHash("sha256").update("yugm:d1-seed:v1:" + catalog + ":" + key).digest("hex").slice(0, 24);
}

function seedRows(
  table: string, columns: string[], rows: Value[][], naturalKey: string[],
  options: { timestamps?: boolean; parent?: { table: string; key: string } } = {}
) {
  const columnList = columns.map(name => '"' + name + '"').join(", ");
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
  const timestamps = options.timestamps ? ", created_at, updated_at" : "";
  const timestampValues = options.timestamps ? ", " + now + ", " + now : "";
  const values = rows.map(row => "  (" + row.map(literal).join(", ") + ")").join(",\n");
  const keyMatch = naturalKey.map(key => 'stored."' + key + '" = seed."' + key + '"').join(" AND ");
  const parent = options.parent
    ? "\n  AND EXISTS (SELECT 1 FROM " + options.parent.table + " WHERE source_id = seed." + options.parent.key + ")"
    : "";
  return [
    "WITH seed (" + columnList + ") AS (VALUES", values, ")",
    "INSERT INTO " + table + " (" + columnList + timestamps + ")",
    "SELECT " + columnList + timestampValues + " FROM seed",
    "WHERE NOT EXISTS (SELECT 1 FROM " + table + " AS stored WHERE " + keyMatch + ")" + parent,
    "ON CONFLICT (source_id) DO NOTHING;"
  ].join("\n");
}

const cosmetics = seedRows("cosmetics", [
  "source_id", "type", "name", "coin_price", "rarity", "preview", "is_active", "reward_only", "asset_kind", "asset_url"
], profileCosmetics.map(entry => [
  entry.id, entry.type, entry.name, entry.coinPrice, entry.rarity, entry.preview, true, false,
  "assetKind" in entry ? entry.assetKind : null, "assetUrl" in entry ? entry.assetUrl : null
]), ["source_id"], { timestamps: true });

const achievements = seedRows("achievements", [
  "source_id", "id", "title", "description", "category", "icon", "kind", "metric", "weekly_target", "hidden", "order"
], defaultAchievements.map(entry => [
  sourceId("achievement", entry.id), entry.id, entry.title, entry.description, entry.category, entry.icon,
  "kind" in entry ? entry.kind : "ACHIEVEMENT",
  "metric" in entry ? entry.metric ?? null : null,
  "weeklyTarget" in entry ? entry.weeklyTarget ?? null : null, false, entry.order
]), ["id"], { timestamps: true });

const tiers = seedRows("achievement_tiers", [
  "source_id", "tier", "target", "reward_coins", "reward_cosmetic", "achievements_id", "position"
], defaultAchievements.flatMap(entry => {
  const id = sourceId("achievement", entry.id);
  return entry.tiers.map((tier, position) => [
    id + ":tiers:" + position, tier.tier, tier.target, tier.rewardCoins, tier.rewardCosmetic ?? null, id, position
  ]);
}), ["achievements_id", "tier"], { parent: { table: "achievements", key: "achievements_id" } });

const gifts = seedRows("gifts", [
  "source_id", "name", "icon", "coin_price", "pk_points", "diamond_price", "is_active", "effect3d", "interactive",
  "animation_key", "combo_multiplier", "category", "bond_points", "bond_minimum_days", "theme", "rarity",
  "limited_edition_active", "limited_edition_total", "limited_edition_remaining", "tradable", "upgradeable",
  "achievement_gift", "pet_gift", "vehicle_gift"
], baseGifts.map(entry => {
  const limited = entry.limitedEdition;
  return [
    sourceId("gift", entry.name), entry.name, entry.icon, entry.coinPrice, entry.pkPoints, entry.diamondPrice, true, "", false,
    "", 1, entry.category, 0, 0, "", entry.rarity, limited?.active ?? false, limited?.total ?? 0, limited?.remaining ?? 0,
    entry.tradable, entry.upgradeable ?? false, false, false, false
  ];
}), ["name"], { timestamps: true });

process.stdout.write([
  "-- Yugm reference catalogs. Generated from the checked-in catalogs by npm run d1:seed:sql.",
  "-- Applied migrations are immutable. Put later catalog additions in a new migration.",
  "", cosmetics, "", achievements, "", tiers, "", gifts, ""
].join("\n"));
