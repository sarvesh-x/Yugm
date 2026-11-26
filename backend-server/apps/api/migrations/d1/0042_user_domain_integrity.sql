-- User-domain integrity keys. Deduplicate first so the new ownership index can
-- be applied to databases that already contain imported duplicate rows.
DELETE FROM "user_owned_cosmetics" WHERE "value" IS NOT NULL AND "source_id" NOT IN (
  SELECT MIN("source_id") FROM "user_owned_cosmetics" WHERE "value" IS NOT NULL
  GROUP BY "users_id", "value"
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_owned_cosmetics_owner_value"
  ON "user_owned_cosmetics" ("users_id", "value") WHERE "value" IS NOT NULL;

-- One active bond per pair; historical ended/terminated rows are still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bonds_active_pair"
  ON "bonds" ("pair_key") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "idx_bonds_pair_status" ON "bonds" ("pair_key", "status");
CREATE INDEX IF NOT EXISTS "idx_bond_requests_status_expires" ON "bond_requests" ("status", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_bond_points_kind_created" ON "bond_points" ("kind", "created_at");
