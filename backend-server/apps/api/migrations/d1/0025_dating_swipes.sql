CREATE UNIQUE INDEX IF NOT EXISTS "idx_likes_pair" ON "likes" ("liker_id", "liked_id");
CREATE INDEX IF NOT EXISTS "idx_likes_liked_type" ON "likes" ("liked_id", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_relationships_pair_key" ON "relationships" ("pair_key");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_relationship_users_pair" ON "relationship_users" ("relationships_id", "value");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_match_users_pair" ON "match_users" ("matches_id", "value");
CREATE INDEX IF NOT EXISTS "idx_match_users_value" ON "match_users" ("value");
ALTER TABLE "matches" ADD COLUMN "pair_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_matches_pair_key" ON "matches" ("pair_key") WHERE "pair_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_matches_created_at" ON "matches" ("created_at");
