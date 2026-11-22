import mongoose from "mongoose";

interface Migration {
  version: number;
  name: string;
  up: (db: mongoose.mongo.Db) => Promise<void>;
  down?: (db: mongoose.mongo.Db) => Promise<void>;
}

const migrations: Migration[] = [];

export function defineMigration(version: number, name: string, up: (db: mongoose.mongo.Db) => Promise<void>, down?: (db: mongoose.mongo.Db) => Promise<void>) {
  migrations.push({ version, name, up, down });
}

/** Removes Mongoose's legacy default-named equivalents before named indexes are created. */
async function dropLegacyIndexes(collection: mongoose.mongo.Collection, names: string[]) {
  for (const name of names) await collection.dropIndex(name).catch(() => {});
}

async function getAppliedVersions(db: mongoose.mongo.Db): Promise<number[]> {
  try {
    const docs = await db.collection("_migrations").find().sort({ version: 1 }).toArray();
    return docs.map((d) => d.version);
  } catch {
    await db.collection("_migrations").insertOne({ version: 0, name: "schema_init", appliedAt: new Date() });
    return [0];
  }
}

export async function runMigrations() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  const applied = await getAppliedVersions(db);
  const pending = migrations
    .filter((m) => !applied.includes(m.version))
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    console.log("No pending migrations");
    return;
  }

  for (const migration of pending) {
    console.log(`Running migration v${migration.version}: ${migration.name}`);
    try {
      await migration.up(db);
      await db.collection("_migrations").insertOne({
        version: migration.version,
        name: migration.name,
        appliedAt: new Date(),
      });
      console.log(`Migration v${migration.version} applied successfully`);
    } catch (error) {
      console.error(`Migration v${migration.version} failed:`, error);
      throw error;
    }
  }
}

defineMigration(1, "create_users_indexes", async (db) => {
  const users = db.collection("users");
  await users.createIndex(
    { firebaseUid: 1 },
    { unique: true, partialFilterExpression: { firebaseUid: { $type: "string" } } }
  );
  await users.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: "string" } } }
  );
  await users.createIndex({ username: 1 }, { unique: true });
});

defineMigration(2, "create_rooms_indexes", async (db) => {
  await db.collection("rooms").createIndex({ status: 1, createdAt: -1 });
  await db.collection("rooms").createIndex({ hostId: 1, status: 1 });
  await db.collection("rooms").createIndex({ scheduledAt: 1 }, { sparse: true });
});

defineMigration(3, "create_notifications_ttl", async (db) => {
  await db.collection("notifications").createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
});

defineMigration(4, "create_stories_ttl", async (db) => {
  await db.collection("stories").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("stories").createIndex({ userId: 1, createdAt: -1 });
});

defineMigration(5, "create_wallet_transactions_indexes", async (db) => {
  await db.collection("wallettransactions").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("wallettransactions").createIndex({ source: 1, createdAt: -1 });
});

// Additive only: creates indexes for the new asset registry. No existing
// cosmetic, achievement, gift or user document is read or rewritten here.
defineMigration(6, "create_asset_objects_indexes", async (db) => {
  const assets = db.collection("assetobjects");
  await dropLegacyIndexes(assets, [
    "ownerType_1_ownerId_1_version_1",
    "ownerType_1_ownerId_1_sha256_1",
    "status_1_createdAt_-1"
  ]);
  await assets.createIndex({ ownerType: 1, ownerId: 1, version: 1 }, { unique: true, name: "asset_owner_version" });
  await assets.createIndex({ ownerType: 1, ownerId: 1, sha256: 1 }, { name: "asset_owner_sha256" });
  await assets.createIndex({ status: 1, createdAt: -1 }, { name: "asset_status_created" });
}, async (db) => {
  await db.collection("assetobjects").dropIndex("asset_owner_version").catch(() => {});
  await db.collection("assetobjects").dropIndex("asset_owner_sha256").catch(() => {});
  await db.collection("assetobjects").dropIndex("asset_status_created").catch(() => {});
});

// Additive only: index for the optional cosmetic -> published asset reference.
// No cosmetic document is rewritten; legacy assetUrl values stay untouched.
defineMigration(7, "create_cosmetic_asset_ref_index", async (db) => {
  await db.collection("cosmetics").createIndex({ assetRef: 1 }, { name: "cosmetic_asset_ref", sparse: true });
}, async (db) => {
  await db.collection("cosmetics").dropIndex("cosmetic_asset_ref").catch(() => {});
});

// Additive only: index for the optional badge -> published asset reference.
// Existing badge blobs and imageUrl values are not read or rewritten here.
defineMigration(8, "create_badge_asset_ref_index", async (db) => {
  await db.collection("achievements").createIndex({ assetRef: 1 }, { name: "badge_asset_ref", sparse: true });
}, async (db) => {
  await db.collection("achievements").dropIndex("badge_asset_ref").catch(() => {});
});

// Additive only: indexes for the unified media registry and upload sessions.
// No existing media URL or user document is rewritten by this migration.
defineMigration(9, "create_media_registry_indexes", async (db) => {
  const media = db.collection("mediaobjects");
  await dropLegacyIndexes(media, [
    "ownerType_1_ownerId_1_category_1_version_1",
    "checksum_1",
    "deletedAt_1"
  ]);
  await media.createIndex(
    { ownerType: 1, ownerId: 1, category: 1, version: 1 },
    { unique: true, name: "media_owner_category_version" }
  );
  await media.createIndex({ checksum: 1 }, { name: "media_checksum" });
  await media.createIndex({ supersededById: 1 }, { name: "media_superseded_by", sparse: true });
  await media.createIndex({ deletedAt: 1 }, { name: "media_deleted_at", sparse: true });

  const sessions = db.collection("mediauploadsessions");
  await sessions.createIndex({ userId: 1, status: 1 }, { name: "media_session_user_status" });
  await sessions.createIndex({ expiresAt: 1 }, { name: "media_session_expiry" });
}, async (db) => {
  for (const [collection, indexes] of [
    ["mediaobjects", ["media_owner_category_version", "media_checksum", "media_superseded_by", "media_deleted_at"]],
    ["mediauploadsessions", ["media_session_user_status", "media_session_expiry"]]
  ] as const) {
    for (const index of indexes) await db.collection(collection).dropIndex(index).catch(() => {});
  }
});
