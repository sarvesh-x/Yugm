CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_missions_user_mission" ON "user_missions" ("user_id", "mission_id");
CREATE INDEX IF NOT EXISTS "idx_user_missions_user_completed" ON "user_missions" ("user_id", "completed");
