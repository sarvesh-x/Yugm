/**
 * Generates a first-cut D1 (SQLite) schema from the registered Mongoose models.
 *
 * This is a DESIGN-TIME TOOL ONLY:
 * - it does not connect to MongoDB or D1,
 * - it does not export, transform, import or delete any data,
 * - it never reads credential values,
 * - its output is a reviewable draft that must be checked against
 *   docs/database/mongo-to-relational-mapping.md before being applied.
 *
 * Run from apps/api: npm run schema:d1
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

type Warning = { model: string; field: string; reason: string };
type Table = { model: string; table: string; columns: string[]; indexes: string[]; notes: string[] };

const MODEL_DIR = path.resolve("src/models");
const OUT_DIR = path.resolve("migrations/d1");
const SCHEMA_FILE = path.join(OUT_DIR, "0001_initial.sql");
const MANIFEST_FILE = path.join(OUT_DIR, "0001_initial.manifest.json");

/** Table names fixed by docs/database/mongo-to-relational-mapping.md. */
const TABLE_OVERRIDES: Record<string, string> = {
  AppConfig: "app_config",
  AssetObject: "assets"
};

/**
 * Arrays normalized into child tables where the mapping spec requires joins,
 * ownership checks or stable per-element identities. Everything else stays as
 * JSON TEXT with a warning for manual review.
 */
const CHILD_TABLES: Record<string, Record<string, string>> = {
  User: {
    interests: "user_interests",
    hobbies: "user_hobbies",
    languages: "user_languages",
    ownedCosmeticIds: "user_owned_cosmetics",
    ownedTitles: "user_owned_titles",
    badgeGrants: "user_badge_grants",
    claimedAchievementIds: "user_claimed_achievements",
    claimedAchievementTiers: "user_claimed_achievement_tiers",
    showcasedBadgeIds: "user_showcased_badges",
    profileMedia: "user_profile_media"
  },
  AdminUser: { permissions: "admin_role_permissions" },
  Achievement: { tiers: "achievement_tiers" },
  AssetObject: { variants: "asset_variants" },
  MediaObject: { variants: "media_variants" },
  BattlePass: { rewards: "battle_pass_rewards" },
  Season: { rewards: "season_rewards" },
  VibeGraph: { interests: "vibe_graph_interests", languages: "vibe_graph_languages" },
  GiftCollection: { gifts: "gift_collection_items" },
  ClanMessage: { reactions: "clan_message_reactions" },
  DirectMessage: { reactions: "direct_message_reactions", hiddenFor: "message_hidden_for" },
  GroupChat: { participantIds: "conversation_participants" },
  Poll: { voters: "poll_votes" },
  VoicePoll: { voters: "voice_poll_votes", ballots: "voice_poll_ballots" },
  SupportTicket: { messages: "support_ticket_messages" },
  Event: { participantIds: "event_participants" },
  Story: { viewedBy: "story_views" },
  Bond: { users: "bond_users", slots: "bond_slots" },
  Match: { users: "match_users" },
  Relationship: { users: "relationship_users" },
  RoomModeState: { participants: "room_mode_participants" }
};

const warnings: Warning[] = [];
const allTables: Table[] = [];
const tableNames = new Map<string, string>();

function warn(model: string, field: string, reason: string) {
  warnings.push({ model, field, reason });
}

function snake(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function plural(name: string): string {
  if (/(s|x|z|ch|sh)$/.test(name)) return `${name}es`;
  if (name.endsWith("y")) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

function tableNameFor(model: string): string {
  return TABLE_OVERRIDES[model] || plural(snake(model));
}

function columnName(name: string): string {
  if (name === "_id") return "source_id";
  const mapped = snake(name);
  if (mapped === "createdat") return "created_at";
  if (mapped === "updatedat") return "updated_at";
  return mapped.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/_$/, "");
}

function sqlType(schemaType: any, model: string, field: string): string {
  const instance: string = schemaType?.instance || schemaType?.constructor?.name || "Unknown";
  switch (instance) {
    case "String":
    case "ObjectID":
    case "ObjectId":
    case "Objectid":
    case "UUID":
      return "TEXT";
    case "Number":
      return "INTEGER";
    case "Boolean":
    case "Bool":
      return "INTEGER";
    case "Date":
      return "TEXT";
    case "Decimal128":
      warn(model, field, "Decimal128 stored as TEXT; convert to integer minor units during transform");
      return "TEXT";
    case "Buffer":
      warn(model, field, "binary field stored as TEXT; migration must replace with R2 bucket/key reference");
      return "TEXT";
    case "Mixed":
      warn(model, field, "Mixed stored as JSON TEXT; normalize if the field is queried or joined");
      return "TEXT";
    case "Array":
      warn(model, field, "array stored as JSON TEXT; child-table candidate per mapping spec");
      return "TEXT";
    case "Embedded":
    case "Subdocument":
      warn(model, field, "embedded document stored as JSON TEXT; child-table candidate per mapping spec");
      return "TEXT";
    case "Map":
      warn(model, field, "Map stored as JSON TEXT");
      return "TEXT";
    default:
      warn(model, field, `unmapped Mongoose type '${instance}' defaulted to TEXT; review before use`);
      return "TEXT";
  }
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function literal(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function importModels() {
  const entries = await readdir(MODEL_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
    .map((entry) => path.join(MODEL_DIR, entry.name))
    .sort();

  const failed: string[] = [];
  for (const file of files) {
    try {
      await import(pathToFileURL(file).href);
    } catch (error) {
      failed.push(`${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { loaded: files.length, failed };
}

function columnDefinition(model: string, field: string, schemaType: any, col: string): string {
  const type = sqlType(schemaType, model, field);
  const required = Boolean(schemaType?.isRequired);
  const hasDefault = schemaType?.defaultValue !== undefined;
  if (typeof schemaType?.options?.required === "function") {
    warn(model, field, "conditional required() treated as nullable; enforce in application validation");
  }
  let line = `  ${quote(col)} ${type}${required || hasDefault ? " NOT NULL" : ""}`;

  const enumValues: unknown[] = schemaType?.enumValues || [];
  if (enumValues.length) {
    line += ` CHECK (${quote(col)} IN (${enumValues.map(literal).join(", ")}))`;
  }
  const min = schemaType?.options?.min;
  if (type === "INTEGER" && typeof min === "number") {
    line += ` CHECK (${quote(col)} >= ${min})`;
  }
  const ref = schemaType?.options?.ref;
  if (typeof ref === "string" && tableNames.has(ref)) {
    line += ` REFERENCES ${quote(tableNames.get(ref)!)}("source_id")`;
  }
  return line;
}

function createIndexes(table: string, schema: mongoose.Schema): string[] {
  const indexes: string[] = [];
  schema.indexes().forEach(([fields, options], position) => {
    const indexOptions = (options || {}) as Record<string, unknown>;
    if (indexOptions.background) return;
    const keys = Object.entries(fields as Record<string, 1 | -1 | "text">)
      .filter(([name]) => name !== "_id")
      .map(([name, direction]) => `${quote(columnName(name))} ${direction === -1 ? "DESC" : "ASC"}`)
      .join(", ");
    if (!keys) return;
    const unique = indexOptions.unique ? "UNIQUE " : "";
    indexes.push(`CREATE ${unique}INDEX IF NOT EXISTS ${quote(`idx_${table}_${position + 1}`)} ON ${quote(table)} (${keys});`);
  });
  return indexes;
}

function buildChildTable(model: string, field: string, childTable: string, schemaType: any, parentTable: string): Table {
  const columns = ["  source_id TEXT PRIMARY KEY"];
  const notes: string[] = [];
  const childSchema = schemaType?.schema as mongoose.Schema | undefined;

  if (childSchema) {
    for (const [name, subType] of Object.entries(childSchema.paths)) {
      if (name === "__v") continue;
      const col = name === "_id" ? "element_id" : columnName(name);
      if (name === "_id") {
        notes.push("source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>");
        continue;
      }
      columns.push(columnDefinition(model, `${field}.${name}`, subType, col));
    }
  } else {
    const caster = schemaType?.caster;
    columns.push(columnDefinition(model, field, caster || schemaType, "value"));
    notes.push("source_id is <parent source_id>:<field>:<position>; primitive element stored in value");
  }

  columns.push(`  ${quote(`${columnName(parentTable)}_id`)} TEXT NOT NULL REFERENCES ${quote(parentTable)}("source_id")`);
  columns.push("  position INTEGER NOT NULL CHECK (position >= 0)");
  const indexName = `idx_${childTable}_parent`;
  const indexes = [`CREATE INDEX IF NOT EXISTS ${quote(indexName)} ON ${quote(childTable)} (${quote(`${columnName(parentTable)}_id`)}, position);`];
  return { model: `${model}.${field}`, table: childTable, columns, indexes, notes };
}

function buildTables(modelName: string, schema: mongoose.Schema): Table[] {
  const table = tableNameFor(modelName);
  const columns: string[] = [];
  const notes: string[] = [];
  if (!schema.path("_id")) {
    warn(modelName, "_id", "model has no _id path; importer must supply a stable source_id from a natural key");
  }
  columns.push("  source_id TEXT PRIMARY KEY");

  const childSpecs = CHILD_TABLES[modelName] || {};
  const seenColumns = new Set<string>(["source_id"]);
  for (const [name, schemaType] of Object.entries(schema.paths)) {
    if (name === "_id" || name === "__v") continue;
    if (childSpecs[name]) continue;
    const col = columnName(name);
    // Mongoose Map fields expose both `field` and `field.$*` paths; both
    // sanitize to the same column. Emit it once so the draft is valid SQLite.
    if (seenColumns.has(col)) {
      notes.push(`${name} collapsed onto existing column ${col}; Map wildcard path suppressed`);
      continue;
    }
    seenColumns.add(col);
    columns.push(columnDefinition(modelName, name, schemaType, col));
  }

  if (schema.options.timestamps) {
    if (!seenColumns.has("created_at")) columns.push('  "created_at" TEXT');
    if (!seenColumns.has("updated_at")) columns.push('  "updated_at" TEXT');
    seenColumns.add("created_at");
    seenColumns.add("updated_at");
  }

  for (const [field, childTable] of Object.entries(childSpecs)) {
    const schemaType = schema.path(field);
    if (!schemaType) {
      warn(modelName, field, `child table ${childTable} configured but path does not exist`);
      continue;
    }
    notes.push(`${field} normalized into ${childTable} (no JSON column on parent)`);
    allTables.push(buildChildTable(modelName, field, childTable, schemaType, table));
  }

  return [{ model: modelName, table, columns, indexes: createIndexes(table, schema), notes }];
}

async function main() {
  const importResult = await importModels();
  const modelEntries = mongoose.modelNames()
    .map((name) => [name, (mongoose.model(name) as mongoose.Model<unknown>).schema] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [name] of modelEntries) tableNames.set(name, tableNameFor(name));

  for (const [name, schema] of modelEntries) allTables.push(...buildTables(name, schema));
  allTables.sort((a, b) => a.table.localeCompare(b.table));

  const lines: string[] = [];
  lines.push("-- First-cut Cloudflare D1 schema generated from Mongoose models.");
  lines.push("-- REVIEW REQUIRED: this is a design draft, not an approved migration.");
  lines.push("-- Check every table against docs/database/mongo-to-relational-mapping.md.");
  lines.push("-- No data has been exported, transformed or imported.");
  lines.push("-- Binary content stays in R2; rows hold bucket/key/checksum references only.");
  lines.push("-- Foreign keys use preserved source_id values; defer FK checks during bulk import.");
  lines.push("");
  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");
  for (const table of allTables) {
    for (const note of table.notes) lines.push(`-- ${table.model || table.table}: ${note}`);
    lines.push(`-- Model: ${table.model}`);
    lines.push(`CREATE TABLE IF NOT EXISTS ${quote(table.table)} (`);
    lines.push(table.columns.join(",\n"));
    lines.push(");");
    for (const index of table.indexes) lines.push(index);
    lines.push("");
  }
  if (warnings.length) {
    lines.push("-- Review warnings:");
    for (const warning of warnings) {
      lines.push(`-- ${warning.model}.${warning.field}: ${warning.reason}`);
    }
    lines.push("");
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(SCHEMA_FILE, lines.join("\n"), "utf8");
  await writeFile(
    MANIFEST_FILE,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: "Mongoose model introspection (local source only)",
      modelsImported: importResult.loaded,
      importFailures: importResult.failed,
      rootTableCount: modelEntries.length,
      totalTableCount: allTables.length,
      childTables: allTables.filter((table) => table.model.includes(".")).map((table) => table.table).sort(),
      modelToTable: Object.fromEntries(tableNames),
      warnings
    }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Generated ${allTables.length} tables (${modelEntries.length} roots) -> ${path.relative(process.cwd(), SCHEMA_FILE)}`);
  console.log(`Review warnings: ${warnings.length}; import failures: ${importResult.failed.length}`);
  for (const failure of importResult.failed) console.error(`  import failed: ${failure}`);
}

main().catch((error) => {
  console.error("D1 schema generation failed:", error);
  process.exitCode = 1;
});
