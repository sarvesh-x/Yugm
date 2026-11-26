CREATE UNIQUE INDEX IF NOT EXISTS "idx_pk_participants_battle_user"
  ON "pk_participants" ("battle_id", "user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_pk_votes_battle_voter"
  ON "pk_votes" ("battle_id", "voter_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_pk_leaderboard_entries_battle_user"
  ON "pk_leaderboard_entries" ("battle_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_pk_leaderboard_entries_battle_points"
  ON "pk_leaderboard_entries" ("battle_id", "total_points" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_pk_events_battle_sequence"
  ON "pk_events" ("battle_id", "sequence")
  WHERE "sequence" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pk_events_gift_transaction"
  ON "pk_events" ("gift_transaction_id")
  WHERE "gift_transaction_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_pk_events_battle_created"
  ON "pk_events" ("battle_id", "created_at" DESC);
