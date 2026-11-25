-- Experience achievement claims need one row per user, achievement and tier.
-- The generated 0001 tier CHECK omitted the two legacy badge tiers, so rebuild
-- the child table with the full enum before adding the uniqueness key.
CREATE TABLE IF NOT EXISTS "user_claimed_achievement_tiers_0030" (
  source_id TEXT PRIMARY KEY,
  "achievement_id" TEXT NOT NULL,
  "tier" TEXT NOT NULL CHECK ("tier" IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER')),
  "claimed_at" TEXT NOT NULL,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);

INSERT INTO "user_claimed_achievement_tiers_0030"
  (source_id, achievement_id, tier, claimed_at, users_id, position)
SELECT old.source_id, old.achievement_id, old.tier, old.claimed_at, old.users_id, old.position
FROM "user_claimed_achievement_tiers" AS old
WHERE NOT EXISTS (
  SELECT 1 FROM "user_claimed_achievement_tiers_0030" AS rebuilt
  WHERE rebuilt.source_id = old.source_id
);

DROP TABLE "user_claimed_achievement_tiers";
ALTER TABLE "user_claimed_achievement_tiers_0030" RENAME TO "user_claimed_achievement_tiers";

CREATE INDEX IF NOT EXISTS "idx_user_claimed_achievement_tiers_parent" ON "user_claimed_achievement_tiers" ("users_id", position);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_claimed_achievement_tiers_claim" ON "user_claimed_achievement_tiers" ("users_id", "achievement_id", "tier");
