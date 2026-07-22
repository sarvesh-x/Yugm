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
  await db.collection("users").createIndex({ firebaseUid: 1 }, { unique: true, sparse: true });
  await db.collection("users").createIndex({ email: 1 }, { sparse: true });
  await db.collection("users").createIndex({ username: 1 }, { unique: true, sparse: true });
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
