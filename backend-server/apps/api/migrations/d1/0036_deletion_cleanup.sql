CREATE TABLE IF NOT EXISTS "account_deletions" (
  "source_id" TEXT PRIMARY KEY REFERENCES "users"("source_id"),
  "deletion_requested_at" TEXT NOT NULL,
  "hard_deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_account_deletions_due" ON "account_deletions" ("deletion_requested_at")
  WHERE "hard_deleted_at" IS NULL;
